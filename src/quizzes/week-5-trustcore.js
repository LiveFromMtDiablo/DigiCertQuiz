const quiz = {
  id: "week-5-trustcore",
  title: "DigiCert Weekly Product Quiz #5",
  intro: "This week's focus: TrustCore/NanoROOT",
  maxTime: 100,
  questions: [
    {
      question: "What are the three DigiCert solutions we provide to OEMs building connected products?",
      options: [
        "Device Trust Manager, TrustCore SDK, Document Trust Manager",
        "Device Trust Manager, UltraDNS, Software Trust Manager",
        "Device Trust Manager, Software Trust Manager, TrustCore SDK",
        "Device Trust Manager, Certificate Lifecycle Management, NanoROOT",
      ],
      correctAnswer: 2,
    },
    {
      question: "What is DigiCert TrustCore SDK primarily designed to do?",
      options: [
        "Automate the management of SSL/TLS certificates for websites and cloud applications",
        "Provide a cryptographic security toolkit for embedded and IoT devices",
        "Replace traditional hardware security modules with open-source software libraries for devices",
        "Deliver analytics and monitoring tools for connected devices and IoT systems",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which of the following best illustrates a real-world use case for DigiCert TrustCore SDK?",
      options: [
        "A smartwatch manufacturer uses TrustCore to brace for system outages",
        "A medical device OEM integrates TrustCore to  provide device security",
        "A cloud marketing platform embeds TrustCore to secure campaign conversions",
        "A social media app uses TrustCore to authenticate personalized content recommendations",
      ],
      correctAnswer: 1,
    },
    {
      question: "Which of the below options best describes how TrustCore SDK provide readiness for post-quantum cryptography (PQC)?",
      options: [
        "By offering ML-KEM and ML-DSA support to replace existing RSA and ECC algorithms across all devices by default",
        "By emulating quantum algorithms in software to simulate post-quantum conditions for device testing",
        "By storing post-quantum keys in hardware secure elements without integrating them into the SDK’s cryptographic libraries",
        "By offering hybrid cryptographic support, combining classical algorithms with approved or emerging PQC algorithms",
      ],
      correctAnswer: 0,
    },
    {
      question: "How does NanoROOT extend the reach of TrustCore SDK?",
      options: [
        "By providing a software-based root of trust for devices that lack built-in hardware roots",
        "By acting as a lightweight post-quantum encryption algorithm for embedded systems",
        "By serving as DigiCert’s cloud service for remote certificate renewal and lifecycle automation",
        "By functioning as a TPM (Trusted Platform Module) replacement that requires no cryptographic validation",
      ],
      correctAnswer: 0,
    },
  ],
};

export default quiz;
