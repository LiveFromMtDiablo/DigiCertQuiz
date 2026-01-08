const quiz = {
  id: "week-10-software-trust",
  title: "DigiCert Weekly Product Quiz #10",
  intro: "This week's focus: Software Trust",
  maxTime: 100,
  questions: [
    {
      question: "Software Trust Manager supports signing which artifact types? (Select all that apply)",
      options: [
        "Software binaries",
        "SBOMs",
        "Container images",
        "Firmware packages",
        "All of the above",
      ],
      correctAnswer: 4,
    },
    {
      question: "What is the ultimate goal of Software Trust Manager in the software supply chain?",
      options: [
        "To eliminate developers",
        "To ensure trust, integrity, and compliance in software releases",
        "To replace CI/CD tools",
        "To provide free hosting",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which industries benefit most from Software Trust Manager? (Select all that apply)",
      options: [
        "Software vendors",
        "IoT manufacturers",
        "Automotive and healthcare",
        "Financial services",
        "All of the above",
      ],
      correctAnswer: 4,
    },
    {
      question: "Why is signing SBOMs critical?",
      options: [
        "Ensures authenticity and integrity of SBOM data",
        "Speeds up builds",
        "Reduces storage costs",
        "Makes SBOM optional",
      ],
      correctAnswer: 0,
    },
    {
      question: "What is a key benefit of keypair profiles in Software Trust Manager?",
      options: [
        "Define signing policies per keypair",
        "Enforce algorithm and validity rules",
        "Control usage by team or pipeline",
        "Discover Keys on Build Servers",
        "B, C, and D",
        "A, B, and C",
      ],
      correctAnswer: 5,
    },
  ],
};

export default quiz;
