const quiz = {
  id: "week-11-tlm-part-2",
  title: "DigiCert Weekly Product Quiz #12",
  intro: "This week's focus: Compliance Dates",
  maxTime: 100,
  questions: [
    {
      question: "On what date will DigiCert enforce the new 199-day maximum validity for public TLS/SSL certificates issued via CertCentral?",
      options: [
        "December 22, 2025",
        "January 21, 2026",
        "February 24, 2026",
        "June 15, 2026",
      ],
      correctAnswer: 2,
    },
    {
      question: "When will DigiCert enforce multi-perspective issuance corroboration (MPIC) by at least three remote network locations across multiple regions?",
      options: [
        "September 1, 2025",
        "January 21, 2026",
        "February 24, 2026",
        "December 22, 2026",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "On what date will DigiCert shorten domain validation (DV) reuse periods from 397 days to 199 days?",
      options: [
        "September 1, 2025",
        "January 21, 2026",
        "February 24, 2026",
        "December 22, 2026",
      ],
      correctAnswer: 2,
    },
    {
      question: "What happens to certificate requests issued on or after February 24, 2026, if they specify a validity longer than 199 days?",
      options: [
        "The request is rejected outright",
        "The request is delayed for manual review",
        "The request is issued with the originally requested validity",
        "The validity is automatically truncated to 199 days",
      ],
      correctAnswer: 3,
    },
    {
      question: "How are existing TLS certificates issued before February 24, 2026, affected by the new 199-day validity limit?",
      options: [
        "They are automatically revoked on February 24",
        "They are shortened to 199 days retroactively",
        "They must be revalidated on February 24",
        "They remain valid until their original expiration date",
      ],
      correctAnswer: 3,
    },
  ],
};

export default quiz;
