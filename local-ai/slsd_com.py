"""SL Smart Design 10.20.1: run an SL Smart Design macro in the PowerPoint the user is working in.

The SL Smart Design ribbon tab now belongs to the AI Visual Builder web add-in (manifest-slsd.xml), so every button -
AI Visual Builder included - works on the first click (Office opens a web add-in's own task pane and functions itself).
The original SL Smart Design commands stay in the company's VBA add-in, unchanged (licence check included): a button
asks this host (server.py /api/slsd/run, a fixed list of macros) and this module calls PowerPoint's documented
Application.Run("SL_Smart_Design_v2_Key_Dec_25.ppam!Module1.<macro>") through COM - the same thing the VBA ribbon did.

Standard library only (ctypes IDispatch late binding): no pywin32, and no PowerShell or other process is started, so
nothing here looks like a script launched from Office. Windows only.
"""
import ctypes
import sys
import time

if sys.platform != 'win32':       # pragma: no cover - the hosted (Linux) panel host never runs macros
    raise ImportError('slsd_com needs Windows')

from ctypes import wintypes as W

_ole32 = ctypes.WinDLL('ole32')
_oleaut32 = ctypes.WinDLL('oleaut32')

S_OK, S_FALSE = 0, 1
RPC_E_CHANGED_MODE = 0x80010106
RPC_E_CALL_REJECTED = 0x80010001
RPC_E_SERVERCALL_RETRYLATER = 0x8001010A
MK_E_UNAVAILABLE = 0x800401E3
DISP_E_EXCEPTION = 0x80020009
DISP_E_UNKNOWNNAME = 0x80020006
CO_E_CLASSSTRING = 0x800401F3
BUSY = (RPC_E_CALL_REJECTED, RPC_E_SERVERCALL_RETRYLATER)

DISPATCH_METHOD, DISPATCH_PROPERTYGET = 1, 2
VT_EMPTY, VT_NULL, VT_I2, VT_I4, VT_BSTR, VT_DISPATCH, VT_BOOL = 0, 1, 2, 3, 8, 9, 11
CLSCTX_ALL = 0x17
COINIT_APARTMENTTHREADED = 0x2


class GUID(ctypes.Structure):
    _fields_ = [('Data1', ctypes.c_ulong), ('Data2', ctypes.c_ushort), ('Data3', ctypes.c_ushort), ('Data4', ctypes.c_ubyte * 8)]


class _VU(ctypes.Union):
    _fields_ = [('llVal', ctypes.c_longlong), ('lVal', ctypes.c_long), ('iVal', ctypes.c_short), ('boolVal', ctypes.c_short),
                ('ptr', ctypes.c_void_p), ('dblVal', ctypes.c_double), ('_rec', ctypes.c_void_p * 2)]


class VARIANT(ctypes.Structure):
    _fields_ = [('vt', ctypes.c_ushort), ('r1', ctypes.c_ushort), ('r2', ctypes.c_ushort), ('r3', ctypes.c_ushort), ('u', _VU)]


class DISPPARAMS(ctypes.Structure):
    _fields_ = [('rgvarg', ctypes.POINTER(VARIANT)), ('rgdispidNamedArgs', ctypes.POINTER(ctypes.c_long)),
                ('cArgs', ctypes.c_uint), ('cNamedArgs', ctypes.c_uint)]


class EXCEPINFO(ctypes.Structure):
    _fields_ = [('wCode', ctypes.c_ushort), ('wReserved', ctypes.c_ushort), ('bstrSource', ctypes.c_void_p),
                ('bstrDescription', ctypes.c_void_p), ('bstrHelpFile', ctypes.c_void_p), ('dwHelpContext', ctypes.c_ulong),
                ('pvReserved', ctypes.c_void_p), ('pfnDeferredFillIn', ctypes.c_void_p), ('scode', ctypes.c_long)]


_oleaut32.SysAllocString.restype = ctypes.c_void_p
_oleaut32.SysAllocString.argtypes = [ctypes.c_wchar_p]
_oleaut32.SysFreeString.argtypes = [ctypes.c_void_p]
_oleaut32.VariantClear.argtypes = [ctypes.POINTER(VARIANT)]
_oleaut32.GetActiveObject.argtypes = [ctypes.POINTER(GUID), ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)]
_oleaut32.GetActiveObject.restype = ctypes.c_long
_ole32.CLSIDFromProgID.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(GUID)]
_ole32.CLSIDFromProgID.restype = ctypes.c_long
_ole32.CLSIDFromString.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(GUID)]
_ole32.CLSIDFromString.restype = ctypes.c_long
_ole32.CoCreateInstance.argtypes = [ctypes.POINTER(GUID), ctypes.c_void_p, W.DWORD, ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)]
_ole32.CoCreateInstance.restype = ctypes.c_long
_ole32.CoInitializeEx.argtypes = [ctypes.c_void_p, W.DWORD]
_ole32.CoInitializeEx.restype = ctypes.c_long


class COMError(Exception):
    def __init__(self, hr, text=''):
        self.hr = hr & 0xFFFFFFFF
        super().__init__(f'0x{self.hr:08X}' + (f': {text}' if text else ''))
        self.text = text


def _guid(s):
    g = GUID()
    hr = _ole32.CLSIDFromString(s, ctypes.byref(g))
    if hr < 0:
        raise COMError(hr, 'bad GUID')
    return g


IID_IDispatch = _guid('{00020400-0000-0000-C000-000000000046}')
IID_NULL = GUID()


def _vcall(ptr, index, argtypes, *args):
    vtbl = ctypes.cast(ptr, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    fn = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, *argtypes)(vtbl[index])
    return fn(ptr, *args)


def _bstr(p):
    return ctypes.wstring_at(p) if p else ''


class Dispatch:
    """A late-bound COM object (IDispatch). Calls that the application refuses because it is busy are retried for
    `busy_s` seconds (PowerPoint answers RPC_E_CALL_REJECTED while it is in the middle of something)."""

    def __init__(self, ptr, busy_s=10.0):
        self.ptr, self.busy_s = ptr, busy_s

    def release(self):
        if self.ptr:
            _vcall(self.ptr, 2, [])
            self.ptr = None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.release()

    def _dispid(self, name):
        names = (ctypes.c_wchar_p * 1)(name)
        did = ctypes.c_long()
        hr = self._retry(lambda: _vcall(self.ptr, 5, [ctypes.POINTER(GUID), ctypes.c_void_p, ctypes.c_uint, ctypes.c_ulong, ctypes.POINTER(ctypes.c_long)],
                                        ctypes.byref(IID_NULL), names, 1, 0x0400, ctypes.byref(did)))
        if hr < 0:
            raise COMError(hr, f'no member {name!r}')
        return did.value

    def _retry(self, f):
        end = time.time() + self.busy_s
        while True:
            hr = f()
            if (hr & 0xFFFFFFFF) not in BUSY or time.time() > end:
                return hr
            time.sleep(0.25)

    def invoke(self, name, flags, *args):
        did = self._dispid(name)
        n = len(args)
        argv = (VARIANT * max(n, 1))()
        for i, a in enumerate(reversed(args)):          # IDispatch takes the arguments last to first
            v = argv[i]
            if isinstance(a, bool):
                v.vt, v.u.boolVal = VT_BOOL, -1 if a else 0
            elif isinstance(a, int):
                v.vt, v.u.lVal = VT_I4, a
            elif isinstance(a, str):
                v.vt, v.u.ptr = VT_BSTR, _oleaut32.SysAllocString(a)
            elif a is NULL_OBJECT:                       # 10.25: Nothing, for a ribbon callback's unused control argument
                v.vt, v.u.ptr = VT_DISPATCH, None
            else:
                raise TypeError(f'unsupported argument type {type(a).__name__}')
        dp = DISPPARAMS(argv if n else None, None, n, 0)
        res, exc, argerr = VARIANT(), EXCEPINFO(), ctypes.c_uint()
        try:
            hr = self._retry(lambda: _vcall(self.ptr, 6, [ctypes.c_long, ctypes.POINTER(GUID), ctypes.c_ulong, ctypes.c_ushort, ctypes.POINTER(DISPPARAMS),
                                                          ctypes.POINTER(VARIANT), ctypes.POINTER(EXCEPINFO), ctypes.POINTER(ctypes.c_uint)],
                                            did, ctypes.byref(IID_NULL), 0x0400, flags, ctypes.byref(dp), ctypes.byref(res), ctypes.byref(exc), ctypes.byref(argerr)))
        finally:
            for i in range(n):
                _oleaut32.VariantClear(ctypes.byref(argv[i]))
        if hr < 0:
            if (hr & 0xFFFFFFFF) == DISP_E_EXCEPTION and exc.pfnDeferredFillIn:     # some servers fill the text in on request
                ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.POINTER(EXCEPINFO))(exc.pfnDeferredFillIn)(ctypes.byref(exc))
            text = _bstr(exc.bstrDescription) if (hr & 0xFFFFFFFF) == DISP_E_EXCEPTION else ''
            for p in (exc.bstrSource, exc.bstrDescription, exc.bstrHelpFile):
                if p:
                    _oleaut32.SysFreeString(p)
            raise COMError(hr, text or f'{name} failed')
        return self._value(res)

    def _value(self, v):
        vt = v.vt
        if vt in (VT_EMPTY, VT_NULL):
            return None
        if vt == VT_I4:
            return v.u.lVal
        if vt == VT_I2:
            return v.u.iVal
        if vt == VT_BOOL:
            return v.u.boolVal != 0
        if vt == VT_BSTR:
            s = _bstr(v.u.ptr)
            _oleaut32.VariantClear(ctypes.byref(v))
            return s
        if vt == VT_DISPATCH:
            return Dispatch(v.u.ptr, self.busy_s) if v.u.ptr else None     # the reference is now owned by the wrapper
        _oleaut32.VariantClear(ctypes.byref(v))
        return None

    def call(self, name, *args):
        return self.invoke(name, DISPATCH_METHOD | DISPATCH_PROPERTYGET, *args)

    def get(self, name, *args):
        return self.invoke(name, DISPATCH_PROPERTYGET, *args)


def init_thread():
    """Every thread that uses COM: a single-threaded apartment (S_FALSE: already initialised - fine)."""
    hr = _ole32.CoInitializeEx(None, COINIT_APARTMENTTHREADED)
    if hr < 0 and (hr & 0xFFFFFFFF) != RPC_E_CHANGED_MODE:
        raise COMError(hr, 'CoInitializeEx')
    return hr in (S_OK, S_FALSE)


def done_thread(initialised):
    if initialised:
        _ole32.CoUninitialize()


def _clsid(progid):
    g = GUID()
    hr = _ole32.CLSIDFromProgID(progid, ctypes.byref(g))
    if hr < 0:
        raise COMError(hr, f'{progid} is not registered on this PC')
    return g


def _query_dispatch(punk):
    pdisp = ctypes.c_void_p()
    hr = _vcall(punk, 0, [ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)], ctypes.byref(IID_IDispatch), ctypes.byref(pdisp))
    _vcall(punk, 2, [])
    if hr < 0:
        raise COMError(hr, 'no IDispatch')
    return pdisp.value


def create(progid, busy_s=10.0):
    """A new object (used by the tests with Scripting.Dictionary)."""
    p = ctypes.c_void_p()
    hr = _ole32.CoCreateInstance(ctypes.byref(_clsid(progid)), None, CLSCTX_ALL, ctypes.byref(IID_IDispatch), ctypes.byref(p))
    if hr < 0:
        raise COMError(hr, f'cannot create {progid}')
    return Dispatch(p.value, busy_s)


def active(progid, busy_s=10.0):
    """The running application of this Windows session (PowerPoint keeps one per user)."""
    punk = ctypes.c_void_p()
    hr = _oleaut32.GetActiveObject(ctypes.byref(_clsid(progid)), None, ctypes.byref(punk))
    if hr < 0:
        if (hr & 0xFFFFFFFF) == MK_E_UNAVAILABLE:
            raise COMError(hr, f'{progid} is not running')
        raise COMError(hr, f'cannot reach {progid}')
    return Dispatch(_query_dispatch(punk.value), busy_s)


# ---------------------------------------------------------------- SL Smart Design
class MacroError(Exception):
    """A plain-language reason shown to the user (no codes, no paths)."""


def loaded_addins(app):
    """[(name, loaded)] of PowerPoint's VBA add-ins (File > Options > Add-ins > PowerPoint Add-ins)."""
    out = []
    with app.get('AddIns') as ais:
        for i in range(1, (ais.get('Count') or 0) + 1):
            with ais.call('Item', i) as a:
                out.append((str(a.get('Name') or ''), bool(a.get('Loaded'))))
    return out


NULL_OBJECT = object()      # passed as VBA's Nothing (an object argument the macro does not use)


def run_macro(addin_file, module, macro, progid='PowerPoint.Application', args=(), title='SL Smart Design'):
    """PowerPoint's Application.Run on '<addin_file>!<module>.<macro>' (the documented form). Returns when the macro
    has finished - for Alternative Design, when its Select Template window is closed."""
    init = init_thread()
    try:
        try:
            app = active(progid)
        except COMError as e:
            raise MacroError('PowerPoint is not running.' if e.hr == MK_E_UNAVAILABLE else 'PowerPoint could not be reached.') from e
        with app:
            stem = addin_file.rsplit('.', 1)[0].lower()
            state = [l for n, l in loaded_addins(app) if n.lower() in (stem, addin_file.lower())]
            if not state:
                raise MacroError(f'The {title} add-in is not installed in PowerPoint (File > Options > Add-ins > PowerPoint Add-ins).')
            if not state[0]:
                raise MacroError(f'The {title} add-in is installed but not loaded (File > Options > Add-ins > PowerPoint Add-ins > Go: tick it).')
            try:
                app.call('Run', f'{addin_file}!{module}.{macro}', *args)
            except COMError as e:
                if e.hr in BUSY:
                    raise MacroError('PowerPoint is busy (a dialog may be open). Close it and try again.') from e
                raise MacroError(f'{title} reported a problem: ' + (e.text or 'the command did not finish.')) from e
    finally:
        done_thread(init)
