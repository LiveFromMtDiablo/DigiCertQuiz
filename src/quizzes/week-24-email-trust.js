const quiz = {
  id: "week-24-email-trust",
  title: "DigiCert Weekly Product Quiz #24",
  intro:
    "This week's focus: Verified Email, Brand Protection, and Email Trust",
  maxTime: 100,
  questions: [
    {
      question:
        "Why is verified email showing up in DigiCert's brand-protection messaging right now?",
      options: [
        "Because email is often a customer's most frequent brand touchpoint, and impersonation there can damage trust quickly",
        "Because verified email is mainly a deliverability play, while security is only a secondary bonus",
        "Because BIMI and Mark Certificates replace the need for domain authentication controls like DMARC",
        "Because mailbox providers now require all commercial email to use VMCs before delivery",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "Which statement best describes what DMARC is designed to do?",
      options: [
        "Encrypt email content between the sender and recipient using a domain-based policy",
        "Verify whether mail using your domain is coming from authorized sources and tell receivers how to handle failures",
        "Create the visual logo standard that supporting inboxes use for branded email",
        "Issue a certificate that proves a company owns a sending domain",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which statement best describes BIMI's role in trusted email?",
      options: [
        "It lets supporting inboxes display a brand logo when the sender has the right authentication in place",
        "It is the DNS standard used to publish the public key for DKIM signing",
        "It is the policy layer that tells receivers to quarantine or reject spoofed messages",
        "It is the certificate format used to encrypt messages for named recipients",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "A company wants its certified logo to appear next to the sender field in supporting inboxes. Which prerequisite is essential before a DigiCert Mark Certificate can do its job?",
      options: [
        "The sending domain must maintain DMARC enforcement and publish a BIMI record",
        "The company must use a dedicated IP range for every outbound campaign",
        "The logo SVG file must be hosted on the same domain as the MX record",
        "The sending platform must support OCSP stapling for all outbound mail hosts",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "What is the main difference between a Common Mark Certificate (CMC) and a Verified Mark Certificate (VMC)?",
      options: [
        "A CMC is used for transactional email, while a VMC is used for marketing email",
        "A CMC supports logos protected by prior use, while a VMC is for registered trademarks or government marks",
        "A CMC proves domain control, while a VMC proves mailbox ownership",
        "A CMC works without BIMI, while a VMC replaces the need for DMARC enforcement",
      ],
      correctAnswer: 1,
    },
  ],
};

export default quiz;
