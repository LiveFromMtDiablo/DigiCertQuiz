const quiz = {
  id: "week-7-tlm-part-1",
  title: "DigiCert Weekly Product Quiz #7",
  intro: "This week's focus: Trust Lifecycle Manager",
  maxTime: 100,
  questions: [
    {
      question: "DigiCert Trust Lifecycle Manager is a digital trust solution that can:",
      options: [
        "Manage SSL certificates across load balancers, servers, WAFs, and other network and app delivery infrastructure",
        "Manage certificates for users and user machines such as laptops, mobile phones, and desktops",
        "Manage certificates deployed in a cloud environment",
        "All of the above",
      ],
      correctAnswer: 3,
    },
    {
      question: "TLM can manage certificates across:",
      options: [
        "DigiCert CertCentral",
        "DigiCert Private CA",
        "Third-party CAs (e.g., Microsoft, Lets Encrypt, Sectigo, AWS)",
        "All of the above",
      ],
      correctAnswer: 3,
    },
    {
      question:
        "Which of the following is a real-world business problem that is best solved with TLM?",
      options: [
        "A high-volume meat processing company lacks control and visibility over its PKI environment, leading to regular certificate outages",
        "A corporate banking marketing team’s website engagement metrics are not trackable across multiple regions",
        "A tax preparation company’s reporting workflows and auditing processes need large-scale digital signing capability",
        "A game development team needs to host and share version-controlled application source code",
      ],
      correctAnswer: 0,
    },
    {
      question: "Why does using TLM improve governance and compliance?",
      options: [
        "Because the platform blocks all third-party certificate authorities",
        "Because centralized policies and audit reporting enforce consistent certificate practices",
        "Because TLM automatically deletes unused certificates",
        "Because it prevents the use of encryption entirely",
      ],
      correctAnswer: 1,
    },
    {
      question: "How does TLM improve cryptographic agility in environments preparing for quantum-safe transitions?",
      options: [
        "By automatically replacing all RSA keys with PQC algorithms without admin review",
        "Through centralized visibility of algorithm usage and policy-driven enforcement of minimum key standards",
        "By limiting certificate issuance to RSA-2048 to maintain legacy compatibility",
        "By enabling quantum key distribution as a built-in feature",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
