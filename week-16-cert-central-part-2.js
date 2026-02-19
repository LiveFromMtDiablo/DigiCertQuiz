const quiz = {
  id: "week-15-tlm-part-3",
  title: "DigiCert Weekly Product Quiz #16",
  intro: "This week's focus: CertCentral Part 2",
  maxTime: 100,
  questions: [
    {
      question: "What does “Platform Extensibility” actually mean for a Trust Lifecycle Manager (TLM) customer?",
      options: [
        "The ability to automatically scale infrastructure resources up or down based on API load",
        "The ability to support legacy cryptographic standards to maintain backward compatibility with older devices",
        "The ability to expand or customize the platform’s capabilities without changing its core code",
        "The ability to deploy the platform across hybrid environments (e.g., on-premise, cloud, and air-gapped)",
      ],
      correctAnswer: 2,
    },
    {
      question: "Why is the Sensor Extensibility architecture so critical for our Product and Engineering teams?",
      options: [
        "It standardizes integration testing, reducing the scope of regression cycles needed for core releases",
        "It ensures that custom customer requirements are automatically added to the core product roadmap",
        "It prevents the platform team from becoming a bottleneck, allowing integrations to be built and iterated independently",
        "It enforces a strict certification process where only DigiCert-validated hardware can be connected",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "Trust Lifecycle Manager is an extensible platform that fits into a customer's existing ecosystem. What does this mean in practice for a team using a mix of different vendors?",
      options: [
        "They replace their current load balancers and firewalls with DigiCert-native hardware to enable end-to-end automation",
        "They can integrate TLM with their existing infrastructure (like F5, AWS, or ServiceNow) and automate workflows without replacing their current tools",
        "They can use a separate instance of TLM for each different cloud provider they support",
        "They can automate all public certificates, regardless of origin, but private PKI must still be managed manually",
      ],
      correctAnswer: 1,
    },
    {
      question: "A customer wants to automate certificate deployment to a specific firewall (e.g., Palo Alto) but doesn't see a native connector in the UI. What is the extensible approach to solving this?",
      options: [
        "Submit a Connector Request ticket and wait for the quarterly integration pack update",
        "Configure the Generic REST Connector to map the firewall's API endpoints in the UI",
        "Use an external CI/CD tool like Jenkins to script the retrieval and push the certificate via SSH",
        "Use the Sensor Extensibility framework to build or download a custom plugin and upload it directly to TLM",
      ],
      correctAnswer: 3,
    },
    {
      question: "Where can DigiCert employees and customers find production-ready integration scripts and examples to get started?",
      options: [
        "They are available in the Developer Resources section of the DigiCert ONE support portal",
        "The DigiCert Product Solutions GitHub repository ",
        "They must be requested through a Solution Engineer or Account Manager",
        "The Snippets library within the TLM Visual Policy Editor",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
