const quiz = {
  id: "week-11-tlm-part-2",
  title: "DigiCert Weekly Product Quiz #11",
  intro: "This week's focus: Trust Lifecycle Manager, Part 2",
  maxTime: 100,
  questions: [
    {
      question: "What is a federated identity protocol?",
      options: [
        "A protocol that requires all participants to authenticate using a single centralized server",
        "A protocol that enables authentication across independent systems using shared standards while maintaining local control",
        "A protocol used only for cloud-based authentication and limited to cloud-native identity providers",
        "A proprietary authentication protocol owned by a single vendor",
      ],
      correctAnswer: 1,
    },
    {
      question: "Why do federated protocols matter?",
      options: [
        "They eliminate the need for encryption",
        "They allow organizations to securely interoperate without sharing credentials or relying on a single authority",
        "They reduce the need for identity verification",
        "They only apply to consumer applications",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which federated protocols does DigiCert ONE support for Admin Login authentication?",
      options: [
        "LDAP and Kerberos",
        "SSH key-based authentication",
        "SAML and OpenID Connect (OIDC)",
        "NTLM only",
      ],
      correctAnswer: 2,
    },
    {
      question: "Which federated protocols does Trust Lifecycle Manager (TLM) support for authenticating web-based certificate enrollment requests?",
      options: [
        "Basic authentication and local accounts",
        "SSH key-based authentication",
        "OAuth 2.0 and OpenID Connect (OIDC)",
        "SAML only",
      ],
      correctAnswer: 3,
    },
    {
      question: "How can customers use TLM to authenticate certificate enrollment requests against Active Directory or Azure/Entra ID?",
      options: [
        "By storing user passwords directly in DigiCert ONE ",
        "By configuring a SAML identity provider",
        "By issuing certificates without identity verification",
        "By manually approving each enrollment request",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
