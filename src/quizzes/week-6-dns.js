const quiz = {
  id: "week-6-dns",
  title: "DigiCert Weekly Product Quiz #6",
  intro: "This week's focus: DNS",
  maxTime: 100,
  questions: [
    {
      question: "What does DNS stand for?",
      options: [
        "Digital Network Service",
        "Direct Name Server ",
        "Domain Node Service",
        "Domain Name System",
      ],
      correctAnswer: 3,
    },
    {
      question: "Within digital trust, which of the following best describes the function and value of DNS?",
      options: [
        "It encrypts traffic between clients and servers to protect sensitive information",
        "It issues digital certificates that verify the identity of websites and applications",
        "It converts domain names into IP addresses to ensure users reach the intended online service",
        "It stores cryptographic keys used for secure device and server authentication",
      ],
      correctAnswer: 2,
    },
    {
      question:
        "Within DNS operations, which of the following best describes a CNAME (Canonical Name) record?",
      options: [
        "A record that links one domain name to another authoritative domain name",
        "A record that maps a domain name directly to an IPv4 or IPv6 address",
        "A record that designates the mail server responsible for a domain",
        "A record used to store arbitrary text data for verification or configuration",
      ],
      correctAnswer: 0,
    },
    {
      question: "Which port is primarily used for DNS queries and responses across the internet?",
      options: [
        "80",
        "443",
        "53",
        "22",
      ],
      correctAnswer: 2,
    },
    {
      question: "What is the purpose of using DNSSEC within a managed DNS environment?",
      options: [
        "To encrypt all DNS queries and responses for privacy",
        "To cache DNS responses for faster lookups",
        "To protect DNS data integrity using cryptographic signatures",
        "To balance load across multiple nameservers",
      ],
      correctAnswer: 2,
    },
  ],
};

export default quiz;
