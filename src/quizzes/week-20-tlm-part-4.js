const quiz = {
  id: "week-20-tlm-part-4",
  title: "DigiCert Weekly Product Quiz #20",
  intro: "This week's focus: Trust Lifecycle Manager, Part 4: Secure Workforce",
  maxTime: 100,
  questions: [
    {
      question:
        "Which standard protocol does TLM use to deliver certificates to MDM-managed devices such as those enrolled in Microsoft Intune?",
      options: [
        "EST (Enrollment over Secure Transport)",
        "SCEP (Simple Certificate Enrollment Protocol)",
        "ACME (Automatic Certificate Management Environment)",
        "CMP (Certificate Management Protocol)",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "What type of authentication does TLM enable for corporate Wi-Fi and VPN access by provisioning certificates to endpoints?",
      options: [
        "Certificate-based authentication (CBA)",
        "Token-bound device attestation",
        "Federated passkey authentication",
        "Mutual password-based key exchange",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "Which of the following MDM platforms can integrate with TLM to automate certificate provisioning?",
      options: [
        "Microsoft Intune and Jamf Pro, but not VMware Workspace ONE",
        "VMware Workspace ONE only, with Intune support on the roadmap",
        "Intune, Jamf, and VMware Workspace ONE",
        "Any platform that supports the ACME protocol natively",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "What happens to a device's TLM-issued certificates when it is marked as lost or wiped through the MDM?",
      options: [
        "Certificates remain valid but are flagged for review at next renewal",
        "The device is added to a certificate suspension list pending recovery",
        "Certificates are automatically revoked, terminating the device's network access",
        "Certificates expire within 24 hours via a short-lived certificate policy",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "How does TLM simplify certificate management compared to running a standalone Microsoft AD CS (Active Directory Certificate Services) environment?",
      options: [
        "It migrates all AD CS certificates into a cloud-hosted private root",
        "It provides centralized visibility and automation across multiple CAs, OS platforms, and cloud environments",
        "It extends AD CS with a plugin that adds cross-platform enrollment support",
        "It acts as a proxy layer that translates AD CS requests into modern protocol formats",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
