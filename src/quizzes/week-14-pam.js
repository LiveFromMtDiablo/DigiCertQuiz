const quiz = {
  id: "week-14-pam",
  title: "DigiCert Weekly Product Quiz #14",
  intro: "This week's focus: Privileged Access Management (PAM)",
  maxTime: 100,
  questions: [
    {
      question: "Which statement best describes Privileged Access Management (PAM)?",
      options: [
        "A system designed to issue, store, and manage digital certificates across environments",
        "A security solution that controls, monitors, and audits access to privileged accounts and sessions",
        "A security tool used to encrypt application data and protect it at rest",
        "A platform focused on managing passwords for standard enterprise users",
      ],
      correctAnswer: 1,
    },
    {
      question: "What is the primary reason organizations deploy PAM solutions?",
      options: [
        "To streamline application deployment and infrastructure configuration processes",
        "To reduce the risk of credential misuse and unauthorized access to privileged accounts",
        "To replace enterprise identity providers such as Active Directory",
        "To automate the issuance and renewal of certificates",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Why is integrating PAM with Trust Lifecycle Manager (TLM) valuable to customers?",
      options: [
        "To allow PAM platforms to function as certificate authorities",
        "To remove the need for encryption keys in certificate workflows",
        "To securely retrieve and use privileged credentials during certificate discovery and automation workflows",
        "To provide single sign-on for administrators managing certificates",
      ],
      correctAnswer: 2,
    },
    {
      question: "What security risk is reduced by using PAM with TLM connectors?",
      options: [
        "Failures caused by expired or misconfigured certificates",
        "Risks associated with hard-coded or locally stored privileged credentials",
        "Issues related to TLS negotiation and handshake errors",
        "Risks arising from untrusted public certificate authorities",
      ],
      correctAnswer: 1,
    },
    {
      question: "Which PAM providers can TLM integrate with currently to securely fetch credentials?",
      options: [
        "HashiCorp Vault and Azure Key Vault",
        "CyberArk and BeyondTrust",
        "Okta and Ping Identity",
        "AWS IAM and Google Cloud IAM",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
