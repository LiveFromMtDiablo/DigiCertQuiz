# DigiCert Weekly Quiz Brief

This brief captures the standing guidance for writing DigiCert's internal employee fun quiz.

## Goal

Create a quiz that feels timely, credible, and enjoyable:

- not trivially easy
- not so detailed that only a specialist could answer it
- grounded enough that employees outside the exact product area can still make a smart guess

Think: smart coffee-break challenge.

## Core Format

- `5` questions per quiz
- Usually `4` answer options per question
- Multiple-choice only
- Short intro copy in the style of `This week's focus: ...`

## Difficulty And Style

- Aim for medium difficulty
- Test one idea per question
- Favor clear, direct wording over tricky wording
- Use plausible, in-domain distractors rather than joke answers
- Make the correct answer specific and defensible

Good patterns include:

- `Which statement best describes...`
- `What is the primary reason...`
- `Which protocol / platform / standard...`
- `What happens when...`

## Distractor Strategy

Distractors should make a thoughtful employee pause for a second, not laugh them out of the question.

**Ground rule: every distractor must be factually wrong as a description of the product or topic.** A "narrower truth" — a real capability the product has, just not the headline one — still competes with the correct answer and breaks the question's definitiveness. The craft is making a wrong claim *sound* like a real, plausible capability nearby.

Strong distractors come from nearby-but-wrong territory:

- **A capability the product does not have, that sounds like one it might.** Example: "TLM cross-signs certificates from connected CAs" — cross-signing is real PKI vocabulary, but it is a CA function, not a management-layer one.
- **A common misconception in the topic area.** Example: "CA-agnostic platforms consolidate everything onto one CA over time" — a wrong belief many readers hold about multi-CA management.
- **A real action attributed to the wrong actor.** Example: "TLM signs certificate renewals directly" — real action, wrong system; TLM orchestrates issuance through connected CAs rather than signing itself.
- **A real concept applied to the wrong context.** Example: "TLM embeds each source CA's native portal inside its own UI" — real architectural pattern in other tools, not how TLM is built.
- **A real capability with the wrong outcome attached.** Example: "TLM sensors convert discovered certificates into DigiCert-issued replacements" — sensors are real, but they discover, not convert.

A useful sharpening test: would a thoughtful customer plausibly *believe* this is how the product works, even though it isn't? If yes, the distractor is doing its job. If a customer who knows the product would nod along ("yes, the platform really does that"), the distractor is too true and needs sharpening.

Common ways distractors give themselves away:

- **Anti-value framing.** Verbs like *eliminate*, *restrict*, *leave behind*, or *defer* signal "wrong" even when wrapped in plausible language. A distractor that subtracts a feature the platform is known for ("eliminate the need for private CAs" on a multi-CA platform) reads as wrong on first scan.
- **Wrong domain.** A security or operations question with a distractor about pricing, procurement, or commercial routing lives outside the question's frame and gets dismissed without engagement. Keep every option in the same operational domain as the correct answer.
- **Invented categories.** Fabricated product types or made-up technical terms (e.g., "CSR translation layer") read as fiction. Anchor distractors to real, recognizable concepts and named products.
- **Cartoonish claims.** "We made the process worse" wording, joke answers, anti-customer outcomes.

A wrong answer should still sound like something a credible technology company might say on purpose.

Before shipping, check each option by asking:

- Is this wrong in a precise way — misstating a mechanism, attributing a capability to the wrong system, or applying a real concept to the wrong context?
- Would someone with partial knowledge of the topic plausibly consider it?
- Does it avoid cartoonish claims, fake product categories, and "we made the process worse" wording?
- Are all options similar enough in length, specificity, and tone that the correct answer does not stand out visually?

Also watch for structural tells that betray the answer:

- **Stem echo.** If the stem says "CA-agnostic" and the correct answer says "regardless of which CA issued it," the answer is leaking through the wording. Rephrase so the correct option does not repeat the stem's key term.
- **Comprehensive-vs-partial pattern.** If every distractor describes one capability and the correct answer lists *all of them*, readers learn to pick the broadest option. Vary distractor scope so this contrast is not structural across the quiz.
- **Position bias.** Distribute correct answers across all four positions over the course of the quiz. Do not anchor on index `0`.

## Content Priorities

When choosing topics and angles, prioritize:

1. Things that have been in recent tech news
2. Topics DigiCert is publicly talking about
3. Themes that connect to DigiCert products, trust, PKI, identity, compliance, automation, software/device/document trust, or related market trends

If possible, a strong weekly quiz should sit in the overlap of:

- timely industry conversation
- DigiCert-relevant public narrative
- broad employee answerability

## Audience Calibration

The audience is internal DigiCert employees, not only deep subject-matter experts.

That means:

- avoid ultra-obscure implementation details
- avoid requiring memorization of minor internal facts unless they are widely known or recently highlighted
- prefer product positioning, key capabilities, important distinctions, notable standards, major dates, real-world use cases, and recent developments

Two reframings to keep handy when a question feels too narrow:

- **Roster → category.** A question that asks "which of these is in our docs" or "which list contains X" tests memorization. Reframe to test the *category* ("which group are all certificate authorities?") instead of the *roster* ("which connectors are documented?"). The answer stays specific; the path to it shifts from recall to recognition.
- **Internal schema → business scenario.** A question that tests the internal structure of a feature (what fields a profile contains, what config options exist) usually fails the outside-this-team employee test. Reframe as a concrete scenario — an acquisition, an audit, a migration — so the answer is the business outcome, not the schema.

## Fun Dial

A little fun is good, but it should stay subtle:

- light personality in phrasing is welcome
- timely references are great when they do not make the question disposable
- distractors should still feel realistic
- do not turn the quiz into parody or trivia-night chaos

## Question Design Rules

- Keep each question focused on one fact, distinction, or concept
- Make wrong answers believable but clearly less correct
- Avoid “gotcha” wording
- Avoid double negatives
- Avoid answers that are technically true but depend on edge-case interpretation
- Prefer broad recognizability over niche detail

## Final Gut Check

Before shipping a quiz, ask:

- Would a DigiCert employee outside this exact team have a reasonable shot?
- Does this feel current?
- Does this reflect something DigiCert would plausibly want employees thinking about?
- Are the distractors fair?
- Is there at least a little spark or fun in the set?
