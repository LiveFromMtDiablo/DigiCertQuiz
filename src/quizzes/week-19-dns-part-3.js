const quiz = {
  id: "week-19-dns-part-3",
  title: "DigiCert Weekly Product Quiz #19",
  intro: "This week's focus: DNS, Part 3",
  maxTime: 100,
  questions: [
    {
      question:
        "UltraDNS is positioned for which type of customer need?",
      options: [
        "Secure recursive DNS filtering for end-user protection",
        "High-volume, mission-critical DNS workloads",
        "Automated domain registration and renewal management",
        "Internal name resolution for private networks and endpoints",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which DNS record type is used to specify which Certificate Authorities are allowed to issue certificates for a domain?",
      options: [
        "TXT",
        "CAA",
        "SRV",
        "PTR",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "What is the primary function of the SiteBacker feature in DigiCert DNS?",
      options: [
        "It uses geolocation policies to route users to the closest regional endpoint",
        "It monitors servers and automatically redirects traffic during outages",
        "It signs DNS responses to protect records from tampering in transit",
        "It synchronizes primary and secondary DNS zones across providers",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which UltraDNS capability allows administrators to direct DNS responses differently depending on where a query originates?",
      options: [
        "Geo & ASN Routing",
        "SiteBacker",
        "Traffic Controller",
        "Real-Time Traffic Anomaly Detection (RTTAD)",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "Approximately how many DNS transactions does UltraDNS process per day?",
      options: [
        "10 billion",
        "50 billion",
        "200 billion",
        "500 billion",
      ],
      correctAnswer: 2,
    },
  ],
};

export default quiz;
