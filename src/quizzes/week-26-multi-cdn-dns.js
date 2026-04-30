const quiz = {
  id: "week-26-multi-cdn-dns",
  title: "DigiCert Weekly Product Quiz #26",
  intro:
    "This week's focus: Multi-CDN DNS, traffic steering, and keeping digital experiences reachable when the internet has a dramatic afternoon",
  maxTime: 100,
  questions: [
    {
      question:
        "Which statement best describes the main goal of a multi-CDN DNS strategy?",
      options: [
        "Use authoritative DNS policies and health signals to choose among multiple CDN endpoints without depending on one CDN's control plane",
        "Publish equivalent records through several authoritative DNS providers and let recursive resolvers choose the fastest CDN path",
        "Delegate each regional hostname to a different CDN so each provider can independently optimize its own edge network",
        "Use a single CDN's Anycast network to make one provider's edge locations behave like several independent delivery networks",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "Recent cloud and CDN outages have put more attention on DNS failover. What is one practical lesson for multi-CDN planning?",
      options: [
        "A second CDN helps most when routing and health decisions can still be changed outside the failing provider",
        "Failover works best when every CDN uses the same origin, cache, DNS, and security control plane",
        "Authoritative DNS is usually optional once an organization has multiple CDN contracts",
        "The safest response to a CDN outage is always to wait for the provider to recover before making DNS changes",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "In multi-CDN traffic steering, what does real-user monitoring (RUM) help determine?",
      options: [
        "Which CDN is actually performing best for users in different locations and networks",
        "Which certificate authority should issue the next TLS certificate for a domain",
        "Whether DNSSEC signatures should be replaced with shorter cryptographic keys",
        "How many unused DNS records can be deleted from a zone file",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "When organizations used DNS failover to route around a CDN incident, what trade-off did many accept?",
      options: [
        "They could restore reachability, but might temporarily lose CDN-layer services such as edge caching or bot protection",
        "They permanently gave up control of their domain names to the backup CDN provider",
        "They improved availability only by disabling all TLS encryption for the affected domains",
        "They eliminated the need to monitor origins, CDNs, and user experience after the incident",
      ],
      correctAnswer: 0,
    },
    {
      question:
        "How does DigiCert's current PKI + DNS focus connect to multi-CDN DNS operations?",
      options: [
        "It brings certificate and DNS management closer together so automation can reduce manual changes, validation delays, and outage risk",
        "It requires every customer to use one CDN provider so certificate issuance can be centralized",
        "It turns DNS into a replacement for endpoint health checks, traffic steering, and real-time analytics",
        "It removes the need for DNS teams to manage authoritative records for high-traffic domains",
      ],
      correctAnswer: 0,
    },
  ],
};

export default quiz;
