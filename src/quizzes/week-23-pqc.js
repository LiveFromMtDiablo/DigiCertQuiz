const quiz = {
  id: "week-23-pqc",
  title: "DigiCert Weekly Product Quiz #23",
  intro:
    "This week's focus: Post-Quantum Cryptography (PQC), crypto-agility, and DigiCert's role in the quantum-ready future",
  maxTime: 100,
  questions: [
    {
      question:
        "NIST's first finalized PQC standards gave us a new pair of acronyms to remember. Which pairing is correct?",
      options: [
        "ML-KEM is for encryption/key establishment, and ML-DSA is for digital signatures",
        "ML-DSA is for encryption/key establishment, and ML-KEM is for digital signatures",
        "SLH-DSA is for encryption/key establishment, and ML-KEM is for digital signatures",
        "FN-DSA is for encryption/key establishment, and SLH-DSA is for digital signatures",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "According to DigiCert's current public documentation, where is PQC certificate support available today?",
      options: [
        "Only through DigiCert public TLS certificates for the Web PKI",
        "Only through a browser plug-in for quantum-safe HTTPS experiments",
        "Through DigiCert private CA resources, not DigiCert public CAs",
        "Only as a future roadmap item, not in any DigiCert product today",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "Which DigiCert offering is most directly positioned to help developers build quantum-resilient IoT and embedded systems?",
      options: [
        "Device Trust Manager",
        "TrustCore SDK",
        "Software Trust Manager",
        "DigiCert Private CA",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Why are Merkle Tree Certificates (MTCs) getting so much attention in recent quantum-safe HTTPS discussions?",
      options: [
        "They let browsers skip certificate transparency entirely",
        "They are meant to make post-quantum web authentication more scalable than sending huge classical-style certificate chains",
        "They replace certificate authorities with DNSSEC-only trust",
        "They are designed mainly for securing air-gapped industrial networks",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "If you were building DigiCert's 'PQC standards group chat,' which trio most belongs in it?",
      options: [
        "CA/Browser Forum, IETF, and NIST",
        "OWASP, PCI SSC, and ISACA",
        "CNCF, OASIS, and ECMA",
        "W3C, Unicode Consortium, and Khronos Group",
      ],
      correctAnswer: 0,
    },
  ],
};

export default quiz;
