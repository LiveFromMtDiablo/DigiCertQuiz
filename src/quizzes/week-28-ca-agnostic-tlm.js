const quiz = {
  id: "week-28-ca-agnostic-tlm",
  title: "DigiCert Weekly Product Quiz #28",
  intro:
    "This week's focus: CA-agnostic capabilities in Trust Lifecycle Manager",
  maxTime: 100,
  questions: [
    {
      question:
        "Why would an enterprise security team adopt a CA-agnostic certificate platform instead of relying on each CA's native management console?",
      options: [
        "To normalize certificates from each connected CA into a unified DigiCert format that downstream systems can consume consistently",
        "To publish a single revocation feed that combines status from every connected CA into one endpoint clients can poll",
        "To run a single operational workflow for renewal, policy enforcement, and audit that covers the organization's full certificate estate",
        "To override each connected CA's cryptographic constraints so every issued certificate uses the parent organization's preferred algorithms",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "Which statement best reflects how the Trust Lifecycle Manager Inventory page supports CA-agnostic management?",
      options: [
        "It focuses on certificates issued from DigiCert profiles and surfaces third-party certs through separate connector dashboards",
        "It monitors public and private trust certificates discovered, imported, or issued in the account from any CA vendor",
        "It indexes all known certificates but defers renewal and revocation actions to each issuing CA's native portal",
        "It tracks certificates from configured connectors and lists sensor-discovered certs in a separate scan view until they are claimed",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "To support CA-agnostic management, Trust Lifecycle Manager connects to third-party certificate authorities. Which group lists examples of such authorities?",
      options: [
        "AWS Private CA, Microsoft Active Directory Certificate Services, GlobalSign, and Sectigo",
        "Microsoft Intune, Jamf Pro, VMware Workspace ONE, and Kandji",
        "F5 BIG-IP, Citrix ADC, A10 Networks, and ServiceNow",
        "HashiCorp Vault, AWS Key Management Service, Azure Key Vault, and Google Secret Manager",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "DigiCert recently added GlobalSign Certificate Center support to Trust Lifecycle Manager. What does the integration enable?",
      options: [
        "Read-only visibility of GlobalSign-issued certificates in TLM dashboards, with renewal and reissue continuing in the GCC portal",
        "Sensor-based discovery of GlobalSign-issued certificates so they appear in TLM inventory, while issuance stays in GCC",
        "Reissuing existing GlobalSign-managed certificates as DigiCert public certs to consolidate them under a single trust anchor",
        "Managing the full lifecycle of GlobalSign-issued public server certificates — including issuance, renewal, and automation — from Trust Lifecycle Manager",
      ],
      correctAnswer: 3,
    },
    {
      question:
        "An acquisition brings a business unit that uses a different public CA into the parent organization. On integration day one, what does a CA-agnostic certificate lifecycle platform add?",
      options: [
        "It cross-signs the acquired CA's certificates with the parent organization's intermediate so the merged estate chains back to a single trust root",
        "It embeds the acquired CA's native administration portal inside Trust Lifecycle Manager so administrators keep the same workflows they used before the acquisition",
        "Acquired-CA certificates are enrolled in the parent's automation profiles immediately, so renewal and policy enforcement continue without reissue or migration",
        "Trust Lifecycle Manager begins issuing certificate renewals for the acquired estate directly, replacing the acquired CA as the signing authority going forward",
      ],
      correctAnswer: 2,
    },
  ],
};

export default quiz;
