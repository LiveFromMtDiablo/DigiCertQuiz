const quiz = {
  id: "week-27-digicert-history-part-3",
  title: "DigiCert Weekly Product Quiz #27",
  intro:
    "This week's focus: DigiCert History Part 3: Increasing product value across our portfolio",
  maxTime: 100,
  questions: [
    {
      question:
        "DigiCert's qualified electronic signature and seal capabilities for eIDAS-compliant trust services came primarily through which path?",
      options: [
        "The acquisition of QuoVadis, which brought existing European qualified trust services and the accreditations they depend on",
        "An internal product launch built on top of CertCentral and adapted for European regulatory requirements",
        "A licensing partnership with a European CA that allowed DigiCert to issue qualified certificates under that partner's roots",
        "The acquisition of Symantec's PKI business, which included a separate qualified trust services line for Europe",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "As public TLS certificate lifetimes are shortening from multi-year validity toward a period of weeks, what capability did DigiCert add to CertCentral so customers can more easily keep up with the renewal cadence?",
      options: [
        "ACME support for automated issuance and renewal of DigiCert TLS certificates",
        "Multi-year purchasing plans that lock in pricing across shorter individual validity periods",
        "Certificate inventory dashboards that surface upcoming expirations earlier in the cycle",
        "Pre-validated organization profiles so OV and EV reissuance can streamline portions of the validation process",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "Before DigiCert acquired Mocana, the company could already issue certificates for IoT devices but lacked something Mocana brought into the platform. What was that missing piece?",
      options: [
        "An embedded security stack that runs on resource-constrained devices to handle key storage, attestation, and secure communications",
        "A managed root CA program designed specifically for IoT manufacturers to anchor device identity",
        "A device discovery and inventory system to track issued certificates across deployed fleets",
        "A cloud onboarding service that enrolls new devices into customer-specific trust hierarchies",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "DigiCert's Vercara acquisition brought UltraDNS into the portfolio. Which connection most directly ties UltraDNS to CertCentral certificate workflows?",
      options: [
        "UltraDNS adds resilient authoritative DNS and DDoS protection for domains that depend on trusted web experiences",
        "UltraDNS supports DNSSEC, which protects DNS responses and complements CA-issued TLS certificates",
        "Authoritative DNS can support domain control validation, DNS configuration, and a more unified DNS plus certificate workflow",
        "UltraDNS can steer traffic across providers, helping keep sites reachable while TLS continues to secure connections",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "DigiCert's Valimail acquisition expanded the digital trust platform into which customer problem area?",
      options: [
        "Zero trust email authentication, including DMARC-based protection against phishing and spoofing",
        "S/MIME certificates for encrypting individual employee mailboxes and signing outbound messages",
        "TLS certificates for securing mail server connections between sending and receiving domains",
        "Brand Indicators for Message Identification (BIMI) as a visible brand trust signal in supporting inboxes",
      ],
      correctAnswer: 0,
    },
  ],
};

export default quiz;
