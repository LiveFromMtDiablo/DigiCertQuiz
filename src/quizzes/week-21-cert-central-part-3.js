const quiz = {
  id: "week-21-cert-central-part-3",
  title: "DigiCert Weekly Product Quiz #21",
  intro: "This week's focus: CertCentral Part 3",
  maxTime: 100,
  questions: [
    {
      question:
        "When will Chrome and Mozilla remove DigiCert's public G1 Global Root certificates?",
      options: [
        "April 8, 2026",
        "April 15, 2026",
        "May 6, 2026",
        "May 20, 2026",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "On April 15, 2029, which root certificate will Chrome and Mozilla stop trusting?",
      options: [
        "DigiCert Global Root CA",
        "DigiCert Assured ID Root CA",
        "Baltimore CyberTrust Root",
        "DigiCert Global Root G2",
      ],
      correctAnswer: 3,
    },
    {
      question: "Which is the correct statement about Public TLS?",
      options: [
        "DV certificates cannot be issued instantly because domain validation reuse is now allowed",
        "OV certificates require completion of both domain validation and organization validation processes",
        "EV certificates require completion of both domain validation, organization validation, and individual validation processes",
        "Public TLS certificates are used solely to encrypt transactions between servers and browsers (e.g., Chrome, Safari, Edge, and Firefox)",
      ],
      correctAnswer: 1,
    },
    {
      question: "What is the difference between Reissue and Duplicate?",
      options: [
        "Reissue allows changes to the FQDNs but Duplicate does not",
        "Reissue allows changes to the certificate validity end date but Duplicate does not",
        "Reissue allows changes to the certificate EKU profile but Duplicate does not",
        "Reissue allows changes to the Issuer CA but Duplicate does not",
      ],
      correctAnswer: 0,
    },
    {
      question: "What revocation check methods are supported by Public TLS?",
      options: ["OCSP", "OCSP Stapling", "CRL", "All of the above"],
      correctAnswer: 3,
    },
  ],
};

export default quiz;
