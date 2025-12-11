const quiz = {
  id: "week-8-cert-central-part-1",
  title: "DigiCert Weekly Product Quiz #8",
  intro: "This week's focus: CertCentral",
  maxTime: 100,
  questions: [
    {
      question: "What does “public trust” in PKI primarily refer to?",
      options: [
        "Trust created only between two private organizations",
        "The confidence that certificates are recognized and accepted by public browsers and operating systems",
        "Certificates that are used only on internal networks",
        "A PKI that requires no validation of identity",
      ],
      correctAnswer: 1,
    },
    {
      question: "What best describes DigiCert CertCentral?",
      options: [
        "The industry-leading solution for the validation and issuance of public trust certificates",
        "Broadest portfolio of public trust certificate offering (e.g., TLS, SMime, Code signing, Document signing, Mark Certificates etc.",
        "Best root ubiquity (with DigiCert roots embedded across browsers, OS, and applications)",
        "All of the above",
      ],
      correctAnswer: 3,
    },
    {
      question:
        "What year was the CertCentral platform first released?",
      options: [
        "2003",
        "2010",
        "2016",
        "2021",
      ],
      correctAnswer: 2,
    },
    {
      question: "How many customers use CertCentral?",
      options: [
        "Less than 10,000",
        "10,000-50,000",
        "50,000-100,000",
        "More than 100,000",
      ],
      correctAnswer: 3,
    },
    {
      question: "When should a customer use CertCentral Europe?",
      options: [
        "When the customer’s organization is registered in a European Union member country",
        "To obtain support for additional languages and currencies",
        "To ensure customer certificate and validation data handling meets GDPR requirements",
        "To provide European data sovereignty and residency for certificates and to meet specific European compliance needs, such as eIDAS, PKIoverheid, and ZertES",
      ],
      correctAnswer: 3,
    },
  ],
};

export default quiz;
