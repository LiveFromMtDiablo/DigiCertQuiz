const quiz = {
  id: "week-16-cert-central-part-2",
  title: "DigiCert Weekly Product Quiz #16",
  intro: "This week's focus: CertCentral Part 2",
  maxTime: 100,
  questions: [
    {
      question: "Which option is not a method by which CertCentral supports ACME protocol?",
      options: [
        "The new DigiCert Automation Client",
        "Certbot",
        "Any ACME client the customer chooses",
        "SCEP (Simple Certificate Enrollment Protocol)",
      ],
      correctAnswer: 3,
    },
    {
      question: "What is the difference between a TLS certificate and a Verified Mark Certificate?",
      options: [
        "VMCs are installed on customer email servers while TLS is used on their web servers",
        "Both TLS certificates and VMC can be hosted by DigiCert, but customers must provide the CSR for TLS certificates",
        "TLS certificates are used to secure HTTPS connections while VMCs are used by email service providers to verify the organization’s logo",
        "A VMC can only have one logo while a TLS certificate can have multiple logos",
      ],
      correctAnswer: 2,
    },
    {
      question: "What components make up DigiCert’s public trust stack?",
      options: [
        "CertCentral, Registration Authority, Validation Managers, Certificate Authority",
        "Services API, Certificate Issuance Service (CIS), Admin Area, Salesforce",
        "CertCentral UI, Services API, ACME, SCEP",
        "DigiCert Account, Finances, Subaccounts, Reports Library",
      ],
      correctAnswer: 0,
    },
    {
      question: "Which domain validation method is not supported by CertCentral?",
      options: [
        "DNS TXT",
        "Phone call",
        "Email",
        "HTTP Practical Demonstration",
      ],
      correctAnswer: 1,
    },
    {
      question: "How many regional CertCentral instances do we have?",
      options: [
        "One CertCentral instance (US)",
        "Two CertCentral instances (US and EU)",
        "Three CertCentral instances (US, EU, and APAC)",
        "Four CertCentral instances (US, EU, APAC, and JP)",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
