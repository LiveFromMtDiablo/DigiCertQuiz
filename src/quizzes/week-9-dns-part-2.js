const quiz = {
  id: "week-9-dns-part-2",
  title: "DigiCert Weekly Product Quiz #8",
  intro: "This week's focus: DNS, Part 2",
  maxTime: 100,
  questions: [
    {
      question: "What is the primary advantage of using the DigiCert DNS traffic management feature?",
      options: [
        "It automatically renews domain registrations",
        "It routes traffic based on performance and availability",
        "It blocks malicious IP addresses",
        "It encrypts DNS queries end-to-end",
      ],
      correctAnswer: 1,
    },
    {
      question: "Which of the following is a key benefit of geolocation-based DNS routing in a managed DNS service?",
      options: [
        "It offers convenience by allowing users to bypass DNS caching entirely",
        "It reduces latency by ensuring users are directed to servers closest to their location",
        "It improves security by encrypting DNS queries",
        "It guarantees 100% uptime for all endpoints regardless of failure",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which DNS record type maps a domain name to an IP address?",
      options: [
        "MX,
        "A / AAAA",
        "CNAME",
        "TXT",
      ],
      correctAnswer: 1,
    },
    {
      question: "How does real-user monitoring (RUM) integration optimize traffic routing in a multi-CDN setup using managed DNS?",
      options: [
        "It automatically updates DNSSEC keys",
        "It reduces the TTL of all DNS records to zero",
        "It encrypts all DNS queries for privacy",
        "It provides live performance data from actual users",
      ],
      correctAnswer: 3,
    },
    {
      question: "It’s Halloween all over again: Your logs show “phantom CNAMEs” pointing to nowhere. What’s most likely happening?",
      options: [
        "Dangling or misconfigured records",
        "“Ghost users” secretly controlling your domain",
        "DNSSEC conjuring invisible records",
        "A haunted TTL that never expires",
      ],
      correctAnswer: 0,
    },
  ],
};

export default quiz;
