const quiz = {
  id: "week-17-document-trust",
  title: "DigiCert Weekly Product Quiz #17",
  intro: "This week's focus: Document Trust",
  maxTime: 100,
  questions: [
    {
      question: "Which of these are core components of Digital Signature Trust?",
      options: [
        "Identity",
        "Integrity",
        "Legality",
        "All of the above",
      ],
      correctAnswer: 3,
    },
    {
      question: "Which of the following best describes one of the key benefits of Document Trust Manager?",
      options: [
        "It eliminates the need for additional forms of identity verification",
        "It allows only local hardware-based signing options for added security",
        "It provides a unified platform for secure, compliant digital signatures, eSeals, and timestamps",
        "It focuses solely on e-mail and web certificate authentication",
      ],
      correctAnswer: 2,
    },
    {
      question: "Which of these options can help organizations prevent document trust failures?",
      options: [
        "Using multiple signing tools for redundancy",
        "Implementing strong identity verification, tamper-evident digital signatures, and compliant seals",
        "Maintaining archived documents after signing",
        "Allowing employees to manage their own signing methods",
      ],
      correctAnswer: 1,
    },
    {
      question: "What is a major risk of using low-assurance eSignatures?",
      options: [
        "They can be easily shared between users",
        "They make signing documents slower and more expensive",
        "They may lack verifiable identity and proof of authenticity",
        "They are incompatible with most signing platforms",
      ],
      correctAnswer: 2,
    },
    {
      question: "Which of the following definitions is incorrect?",
      options: [
        "A Digital Signature is always backed by a digital certificate that is cryptographically bound to the signature field using PKI",
        "An eSignature is backed by a digital certificate that is cryptographically bound to the signature field using PKI",
        "An e-seal is a digital signature used by a legal entity to certify the origin, authenticity and integrity of documents",
        "Digital Signatures alone provide the ability to verify document integrity, non-repudiation, and with regulatory compliance",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
