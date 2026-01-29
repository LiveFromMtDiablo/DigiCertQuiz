const quiz = {
  id: "week-13-root-strategy",
  title: "DigiCert Weekly Product Quiz #13",
  intro: "This week's focus: Root Strategy",
  maxTime: 100,
  questions: [
    {
      question: "What is the primary driver behind DigiCert’s current root strategy changes?",
      options: [
        "Increased demand for EV certificates",
        "Browser root program policy changes, particularly from Chrome",
        "FReduced availability of intermediate CAs",
        "New government regulations on encryption",
      ],
      correctAnswer: 1,
    },
    {
      question: "What major change is Chrome making regarding public TLS certificates used for mTLS?",
      options: [
        "Chrome will allow unlimited EKUs in public TLS certificates",
        "Chrome will require mTLS certificates to use private roots",
        "Chrome will reject public TLS certificates that include the Client Authentication EKU",
        "Chrome will deprecate all public TLS certificates",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "How many public roots will Chrome allow per Certificate Authority?",
      options: [
        "One",
        "Two",
        "Three",
        "Unlimited",
      ],
      correctAnswer: 1,
    },
    {
      question: "By what date will DigiCert fully remove option for Client Auth EKU in public TLS certificates?",
      options: [
        "October 1, 2025",
        "May 1, 2026",
        "June 15, 2026",
        "September 15, 2027",
      ],
      correctAnswer: 1,
    },
    {
      question: "What is DigiCert’s recommended long-term solution for customers who need mTLS?",
      options: [
        "Continue using browser-trusted public roots",
        "Request permanent exceptions from Chrome",
        "Migrate to Private PKI or X9 hierarchies",
        "Delay migration until 2029",
      ],
      correctAnswer: 2,
    },
  ],
};

export default quiz;
