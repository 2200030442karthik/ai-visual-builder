/* Test inputs (moved out of the panel in V10.4: the panel no longer has "Try an example"). */
var TEST_TEXT = {
  projects: 'Project records\n| ID | Name | Category | Status | Score |\n|---|---|---|---|---|\n| 1001 | Alpha Project | Technology | Completed | 95 |\n| 1002 | Beta Workflow | Operations | In Progress | 78 |\n' +
    '| 1003 | Gamma Analytics | Data Science | Pending | 62 |\n| 1004 | Delta System | Automation | Completed | 89 |\n| 1005 | Omega Testing | Quality Assurance | In Progress | 84 |',
  transactions: 'Transaction records\n| Transaction ID | Date | Department | Quantity | Unit price | Total amount | Status |\n|---|---|---|---:|---:|---:|---|\n' +
    '| TXN-2026-001 | 2026-10-01 | Finance | 12 | ₹450.00 | ₹5,400.00 | Approved |\n| TXN-2026-002 | 2026-10-03 | Marketing | 8 | ₹1,250.00 | ₹10,000.00 | Pending |\n' +
    '| TXN-2026-003 | 2026-10-05 | Engineering | 25 | ₹799.00 | ₹19,975.00 | Approved |\n| TXN-2026-004 | 2026-10-08 | Operations | 15 | ₹320.00 | ₹4,800.00 | Rejected |\n' +
    '| TXN-2026-005 | 2026-10-11 | Analytics | 10 | ₹2,499.00 | ₹24,990.00 | Approved |\n| TXN-2026-006 | 2026-10-14 | Finance | 6 | ₹5,000.00 | ₹30,000.00 | Pending |\n' +
    '| TXN-2026-007 | 2026-10-17 | Marketing | 18 | ₹650.00 | ₹11,700.00 | Approved |\n| TXN-2026-008 | 2026-10-20 | Engineering | 4 | ₹12,500.00 | ₹50,000.00 | Approved |',
  verification: '1. Verify that all required fields are populated.\n2. Check whether duplicate records are identified.\n3. Confirm that numerical values are calculated correctly.\n' +
    '4. Validate that special characters are preserved.\n5. Ensure the final output follows the expected format.',
  performance: 'During the third quarter of 2026, the operations team focused on improving productivity, reducing processing time, and increasing customer satisfaction.\n\n' +
    'The team processed 12,450 requests, of which 11,982 were completed successfully.\n\nThe remaining requests required additional validation, manual intervention, or clarification.',
  special: 'Special characters\nV10_TEST_2026\nA&B\n100%\n₹5,499.50\n#Automation\nuser@example.com\n\nFormula:\nTotal Cost = Quantity × Unit Price\n\nCondition:\nIF(Status = "Completed", "Pass", "Review")',
};
TEST_TEXT.document = ['AI Visual Builder V10 acceptance test', '',
  'Project overview', 'The V10_TEST_2026 project checks that learning content becomes accurate slide visuals. Content is pasted or taken from a slide, the content is analyzed on this PC, and an editable visual is inserted into the approved template.', '',
  TEST_TEXT.projects.replace('Project records\n', 'Project records\n\n'), '',
  'Test scenarios', '', TEST_TEXT.verification, '',
  'Sample calculations', 'Total Cost = Quantity × Unit Price', '12 × ₹450.00 = ₹5,400.00', '8 × ₹1,250.00 = ₹10,000.00', '25 × ₹799.00 = ₹19,975.00', '',
  TEST_TEXT.special, '',
  'Automation explanation', 'Automation is most effective when repetitive tasks are clearly defined and measurable. A reliable workflow should handle missing information, unexpected inputs, and duplicate records without compromising the quality of the final output. Testing should cover both normal operations and unusual scenarios to ensure consistent performance.', '',
  'Business performance', '', TEST_TEXT.performance, '',
  TEST_TEXT.transactions.replace('Transaction records\n', 'Transaction records\n\n'), '',
  'Validation checks', '- Check that every transaction ID is unique.', '- Confirm that each total amount equals quantity times unit price.', '- Verify that no status value is missing.', '- Ensure that currency values keep the ₹ symbol.'].join('\n');
var EXAMPLES = [
  ['Machine learning training', 'Machine learning models are trained using datasets. The training process includes data preprocessing, model training, evaluation, and prediction.'],
  ['Neural network', 'Neural network architecture\nA feedforward neural network has three kinds of layers. The input layer receives 784 pixel values. Two hidden layers of 128 and 64 neurons learn features using the ReLU activation function. The output layer has 10 neurons with softmax, one for each digit class.'],
  ['Supervised vs unsupervised', 'Supervised vs unsupervised learning\nSupervised learning:\n  Uses labeled data\n  Predicts known outcomes\n  Examples: classification, regression\nUnsupervised learning:\n  Uses unlabeled data\n  Finds hidden patterns\n  Examples: clustering, dimensionality reduction'],
  ['Data preprocessing', 'Data preprocessing\n1. Collect raw data from source systems\n2. Clean the data: remove duplicates and fix missing values\n3. Transform features: scaling and one-hot encoding\n4. Split the data into training and test sets'],
  ['Cloud architecture', 'Cloud computing architecture\nUsers access the application through a web browser. Requests pass through a load balancer to a group of web servers in an auto-scaling group. The web servers call an application tier, which stores data in a managed SQL database and files in object storage. A CDN caches static content close to users.'],
  ['Cybersecurity threat detection', 'Cybersecurity threat detection\nA security operations center (SOC) monitors the network around the clock. Logs from firewalls, servers and endpoints are collected in a SIEM. The SIEM correlates events and raises alerts. Analysts investigate each alert, and confirmed incidents trigger the incident response plan.'],
  ['Data engineering pipeline', 'Data engineering pipeline\nData is ingested from APIs and databases using Apache Kafka. Apache Spark jobs clean and transform the data. The results are loaded into a Snowflake data warehouse, and analysts build dashboards in Power BI.'],
  ['Generative and agentic AI', 'Generative AI and agentic AI\nGenerative AI creates new content such as text, images and code in response to a prompt. Agentic AI goes further: an AI agent plans a sequence of actions, uses tools such as search and APIs, observes the results, and repeats until the goal is reached.'],
  ['SQL relationships', 'SQL database relationships\nThe Customers table has a primary key customer_id. The Orders table stores order_id and a foreign key customer_id, so one customer can place many orders (one-to-many). The Order_Items table links Orders and Products, creating a many-to-many relationship between orders and products.'],
  ['Project management workflow', 'Project management workflow\nEvery project moves through five phases: initiation, planning, execution, monitoring and controlling, and closure. The project charter is approved during initiation, and lessons learned are documented at closure.'],
  ['Manufacturing scene (picture)', 'AI in manufacturing\nIn a modern smart factory, a robotic arm with a camera performs quality inspection on products moving along a conveyor belt.'],
  ['Two points: ML applications', 'Machine learning applications\n\n1. Predictive analytics\n2. Image classification'],
  ['Two points: PM priorities', 'Project management priorities\n\n1. Risk management\n2. Stakeholder communication'],
  ['ML workflow (4 steps)', 'Machine learning workflow\n\n1. Data preprocessing\n2. Model training\n3. Model evaluation\n4. Prediction'],
  ['ML workflow (4 steps, arrows)', 'Machine learning workflow\n\nData preprocessing → Model training → Evaluation → Prediction'],
  ['ML applications (6)', 'ML applications\n\n1. Healthcare and medical diagnosis\n2. Finance and fraud detection\n3. Retail and e-commerce\n4. Autonomous vehicles\n5. Cybersecurity\n6. Manufacturing'],
  ['ML lifecycle (7 stages)', 'Machine learning lifecycle\n\nProblem Definition → Data Collection → Data Cleaning and Preprocessing → Feature Engineering → Model Selection and Training → Evaluation and Tuning → Deployment and Monitoring'],
  ['ML lifecycle (7 stages, descriptions)', 'Machine learning lifecycle\n\n1. Problem Definition: Define the business problem, the success metric and the constraints before any data work starts.\n' +
    '2. Data Collection: Gather relevant data from databases, APIs, files and logs, and record where each source comes from.\n' +
    '3. Data Cleaning and Preprocessing: Remove duplicates, handle missing values and outliers, and convert the data into a consistent format.\n' +
    '4. Feature Engineering: Create, select and transform the input variables that help the model learn the pattern.\n' +
    '5. Model Selection and Training: Compare candidate algorithms and train the chosen model on the training data.\n' +
    '6. Evaluation and Tuning: Measure accuracy, precision and recall on unseen data and tune the hyperparameters.\n' +
    '7. Deployment and Monitoring: Release the model to production and monitor its predictions and data drift over time.'],
  ['Cloud architecture (sentence)', 'An application communicates with an API gateway, which routes requests to backend services connected to a database.'],
  ['Project scores', 'Project scores\n\nAlpha: 95\nBeta: 78\nGamma: 62\nDelta: 89\nOmega: 84'],
  ['Project records (table)', TEST_TEXT.projects],
  ['Transaction records (table)', TEST_TEXT.transactions],
  ['Verification scenarios (list)', TEST_TEXT.verification],
  ['Business performance (numbers)', TEST_TEXT.performance],
  ['Special characters and formulas', TEST_TEXT.special],
  ['Long document with 9 sections', TEST_TEXT.document],
  ['Claude statement', 'Claude is an AI model developed by Anthropic.'],
  ['Claude statement (active)', 'Anthropic developed Claude, an AI model.'],
  ['Definition statement', 'Kubernetes is an open-source container orchestration platform.'],
  ['Power BI content types', 'Main types of Power BI content\n\n1. Datasets (Semantic Models): The underlying data source, data model, relationships, and DAX (Data Analysis Expressions) calculations.\n' +
    '2. Reports: Multi-page interactive canvases with charts, graphs, slicers, and cross-filtering visual elements built in Power BI Desktop.\n' +
    '3. Dashboards: Single-page canvases (primarily in the Power BI Service) that feature pinned visuals from one or more reports, designed mainly for high-level monitoring and navigation.\n' +
    '4. Paginated Reports: Pixel-perfect, printable, multi-page layout reports designed for operational printing or PDF generation (built via Report Builder).\n' +
    '5. Workbooks: Excel workbooks uploaded or connected to Power BI that can be viewed or parsed as data models.\n' +
    '6. Apps: Packaged collections of dashboards, reports, and datasets distributed to users.'],
  ['ML workflow (5 stages, intro)', 'Machine learning workflow\nThe machine learning workflow consists of five stages.\nData collection\nData preprocessing\nModel training\nModel evaluation\nPrediction'],
  ['ML workflow (5 stages, title line)', 'Machine learning workflow\nData collection\nData preprocessing\nModel training\nModel evaluation\nPrediction'],
  ['ML workflow (5 stages, intro and arrows)', 'Machine learning workflow\nMachine learning turns raw data into predictions in five stages:\nData collection → Data preprocessing → Model training → Model evaluation → Prediction'],
  ['Mixed content', 'Machine learning workflow\n\nThe machine learning workflow consists of five stages.\n\n1. Data collection\n2. Data preprocessing\n3. Model training\n4. Model evaluation\n5. Prediction\n\nEach stage feeds the next, and the model is retrained when new data arrives.'],
  ['Power BI types (intro)', 'Main types of Power BI content\nPower BI organizes content into six types.\nDatasets\nReports\nDashboards\nPaginated reports\nWorkbooks\nApps'],
  ['Explanatory paragraph', 'Machine learning lets computers learn patterns from data instead of following fixed rules. It is used in healthcare, finance and retail, where models predict outcomes from past examples.'],
  ['Generative AI (sentence)', 'Generative AI\nGenerative AI can create new content such as text, images, music, videos, and computer code when you ask it to.'],
  ['Generative AI (paragraph)', 'Generative AI is a type of artificial intelligence that can create new content. It can produce text, images, music, videos and code when you ask it to.'],
  ['Generative AI (list)', 'Generative AI\nGenerative AI can create:\n- Text\n- Images\n- Music\n- Videos\n- Code when you ask it to'],
  ['Educational content', 'Education\n- What is Educational Content?\n- Education-focused content is content that is created by educators to engage, inspire and inform their students. Gone are the days when students learned from only a textbook and a lecture. Educational content is something that can be creative and personalized to each learner’s needs.\n\n- As a whole, educational content is versatile, accessible, informational, and should be created in a manner that helps you achieve your student’s learning goals.'],
  ['Educational content (plain)', 'What is Educational Content?\nEducation-focused content is content that is created by educators to engage, inspire and inform their students. Gone are the days when students learned from only a textbook and a lecture. Educational content is something that can be creative and personalized to each learner’s needs.\n\nAs a whole, educational content is versatile, accessible, informational, and should be created in a manner that helps you achieve your student’s learning goals.'],
  ['Quick facts', 'Fact\n- A single cloud typically weighs around one million tonnes\n- More Quick Facts\n- Identical twins do not share the exact same fingerprints because conditions in the womb shape them differently.\n- Earth’s rotation is slowly changing, meaning the length of a day increases by about 1.8 seconds every century.\n- Leftover pasta contains more resistant starch after it cools down, which helps improve gut health and blood sugar control.'],
  ['Automation validation report', "Automation validation report\n\nProject ID: V10_TEST_2026\nDepartment: R&D\nCompletion rate: 100%\nTotal budget: ₹5,499.50\nEmail: automation@example.com\nTag: #Automation\n\nFormula:\nTotal Cost = Quantity × Unit Price\n\nCondition:\nIF(Status = \"Completed\", \"Pass\", \"Review\")\n\nValidation requirements:\n- Preserve all special characters.\n- Maintain exact numbers and formulas.\n- Display the condition without changing its meaning."],
  ['Data engineering platform (8 concepts)', "Data engineering platform\n\n1. Data ingestion: The platform collects data from databases, APIs, application logs, and external files. Incoming records are checked for basic completeness.\n\n2. Data validation: The system verifies required fields, examines data types, and identifies missing values before processing continues.\n\n3. Data transformation: Raw information is cleaned, standardized, and converted into consistent formats suitable for analysis.\n\n4. Data storage: Processed datasets are stored in appropriate databases or analytical storage systems for efficient retrieval.\n\n5. Data orchestration: Scheduled workflows coordinate dependencies, monitor task execution, and manage processing failures.\n\n6. Data quality monitoring: Automated checks identify duplicate records, invalid values, and unexpected changes in data quality.\n\n7. Analytics and reporting: Dashboards and reports help teams understand performance, operational trends, and business outcomes.\n\n8. Security and governance: Access controls, data classification, and audit records help protect information throughout the processing lifecycle."],
  ['Meaningless text', 'Cvjbk hfvdk;valvxho;bdf\n\nvl;dfvj fkl’\n\nFb d’fbhdfbfd'],
];
/* Content-quality check: must pass (valid) / must be rejected (invalid). tests/test_server.py checks server.py on the same lists. */
var QUALITY_VALID = ['Claude is an AI model developed by Anthropic.', 'Kubernetes', 'Kafka', 'Apache Kafka streams events.', 'SQL, API, AWS, GCP', 'x = np.array([1, 2, 3])', 'E = mc^2',
  '| a | b |\n|---|---|\n| 1 | 2 |', 'Revenue 2024: 120, 2025: 150', 'Machin lerning modle trainng', 'Zscaler secures traffic', 'The strengths of rhythm',
  'Use PowerPoint and JavaScript', 'नमस्ते दुनिया', 'El aprendizaje automático es útil', 'GPT-4o and LLaMA', 'Q3 KPIs',
  'Snowflake, Databricks, BigQuery', 'Explainability matters', 'SELECT name FROM users WHERE id = 7;', 'def train(model): return model.fit(X, y)'];
var QUALITY_INVALID = ['Cvjbk hfvdk;valvxho;bdf\n\nvl;dfvj fkl’\n\nFb d’fbhdfbfd', 'asdfgh jkl qwerty', 'sdkjfh sdkfjh sdfkjh', 'qwrtp zxcvb mnbvc', 'xkcd vbnm', 'zzzz'];
