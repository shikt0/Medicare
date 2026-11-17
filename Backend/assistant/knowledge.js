// Source content checked on 2026-11-18. These short paraphrases are a deliberately
// limited patient-education library, not a clinical guideline or diagnostic tool.
// Keep the source with every answer. No patient message is sent to these sites.
const KNOWLEDGE = [
  {
    title: 'Preparing for your appointment — MedlinePlus',
    url: 'https://medlineplus.gov/talkingwithyourdoctor.html',
    text: 'Bring a list of your medicines, supplements, and allergies, plus the questions you want to ask. If you have symptoms, note when they started and what makes them better or worse. You can take notes during the visit and ask your doctor to explain anything unclear.',
    matches: [/\b(?:prepar\w*|bring|questions?|checklist)\b.{0,55}\b(?:appointment|visit|doctor|consultation)\b/, /\b(?:appointment|visit|consultation)\b.{0,55}\b(?:prepar\w*|bring|questions?|checklist)\b/, /\b(?:describe|record|write down|track)\b.{0,30}\bsymptoms?\b/, /অ্যাপয়েন্টমেন্ট.*প্রস্তুতি|ডাক্তারের.*প্রস্তুতি/],
  },
  {
    title: 'Using medicines safely — MedlinePlus',
    url: 'https://medlineplus.gov/medicationerrors.html',
    text: 'Keep a list of your medicines, supplements, and allergies to share with your doctor or pharmacist. Follow the instructions on each label. If you are unsure about side effects or taking medicines together, ask your pharmacist to check your specific medicines.',
    matches: [/\b(?:medicines?|medications?|prescriptions?|supplements?|drug interactions?|side effects?)\b/, /ওষুধ|ঔষধ/],
  },
  {
    title: 'Preparing for a laboratory test — MedlinePlus',
    url: 'https://medlineplus.gov/lab-tests/how-to-prepare-for-a-lab-test/',
    text: 'It depends on the test: some need fasting and others do not. Follow your lab or doctor’s instructions, and ask how long to fast if that is required. Tell them what medicines and supplements you take. Do not stop a medicine for a test unless your doctor tells you to.',
    matches: [/\b(?:fasting|fast|prepar\w*)\b.{0,55}\b(?:lab|laboratory|blood|test)\b/, /\b(?:lab|laboratory|blood)\b.{0,55}\b(?:fasting|fast|prepar\w*)\b/, /পরীক্ষা.*প্রস্তুতি|খালি পেটে/],
  },
  {
    title: 'Understanding laboratory results — MedlinePlus',
    url: 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/',
    text: 'Check the units and reference range printed on your own lab report. A result outside that range does not automatically mean you are ill, and a result inside it does not rule out every problem. Your doctor puts the result together with your symptoms and health history.',
    matches: [/\b(?:lab(?:oratory)?|blood|test)\s+(?:test\s+)?(?:results?|reports?)\b/, /\b(?:reference range|normal range|false positive|false negative|inconclusive)\b/, /রিপোর্ট|পরীক্ষার ফল/],
  },
  {
    title: 'Understanding diabetes — World Health Organization',
    url: 'https://www.who.int/news-room/fact-sheets/detail/diabetes',
    text: 'Diabetes affects how your body makes or uses insulin, the hormone that helps control blood sugar. It can cause thirst, frequent urination, tiredness, blurred vision, or unexplained weight loss, but type 2 symptoms may be subtle. A clinician uses tests to check for diabetes and plan care.',
    matches: [/\b(?:diabetes|diabetic|blood glucose|blood sugar)\b/, /ডায়াবেটিস|ডায়াবেটিস/],
  },
  {
    title: 'Understanding high blood pressure — World Health Organization',
    url: 'https://www.who.int/news-room/fact-sheets/detail/hypertension',
    text: 'High blood pressure often has no noticeable symptoms, so having it measured matters. The first number is the pressure when your heart beats; the second is the pressure between beats. Your clinician can assess your readings and discuss lifestyle changes or medicines if needed.',
    matches: [/\b(?:hypertension|high blood pressure|blood pressure|systolic|diastolic)\b/, /উচ্চ রক্তচাপ|ব্লাড প্রেশার/],
  },
]

const EMERGENCY_SOURCE = {
  title: 'Recognising medical emergencies — NHS',
  url: 'https://www.essex.icb.nhs.uk/health/support/accident-and-emergency/',
}

function normalizedMessage(message) {
  return typeof message === 'string' ? message.normalize('NFKC').replace(/[’‘]/g, "'").toLowerCase().trim() : ''
}

// A condition or specialty name in a clinic search is not a request for medical
// advice. Do not let education snippets replace the live doctor/schedule answer.
function clinicNavigation(text) {
  const directory = /\b(?:doctors?|specialists?|consultants?|physicians?|cardiologists?|dermatologists?|neurologists?|endocrinologists?|specialt(?:y|ies)|speciali[sz]ations?|departments?|clinics?)\b/
  const action = /\b(?:find|show|list|search|looking for|look for|need|want|see|recommend|available|availability|appointment|book|booking|schedule|fees?|charges?|prices?|costs?)\b/
  return (directory.test(text) && action.test(text))
    || /\b(?:book|booking|reschedule|cancel|availability|available slots?|appointment (?:times?|fees?)|(?:my|upcoming|next|today'?s|tomorrow'?s) (?:appointments?|bookings?|patients?|schedule))\b/.test(text)
    || /\b(?:how many|count|number of)\b.{0,60}\b(?:appointments?|bookings?|patients?|doctors?|slots?)\b/.test(text)
    || /(?:খুঁজ|দেখা|তালিকা|বুক|অ্যাপয়েন্টমেন্ট|অ্যাপয়েন্টমেন্ট|ফি|সময়|সময়).*(?:ডাক্তার|বিশেষজ্ঞ)|(?:ডাক্তার|বিশেষজ্ঞ).*(?:খুঁজ|তালিকা|ফি|সময়|সময়)/.test(text)
}

function preparationQuestion(text) {
  return /\b(?:prepar\w*|bring|checklist|questions? to ask|what should i ask|what should i know)\b/.test(text)
    || /প্রস্তুতি|কি আনব|কী আনব/.test(text)
}

export function selectKnowledge(message) {
  const text = normalizedMessage(message)
  if (clinicNavigation(text) && !preparationQuestion(text)) return []
  return KNOWLEDGE
    .map((item, index) => ({ item, index, score: item.matches.reduce((score, matcher) => score + Number(matcher.test(text)), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .map(({ item: { title, text: content, url } }) => ({ title, text: content, url }))
}

// Keyword checks cannot provide medical triage or cover every language. The
// caller must also keep unsupported clinical questions out of free generation.
function hasPresentEmergency(text) {
  const danger = /\b(?:chest (?:pain|pressure|tightness)|heart attack|stroke|choking|can(?:not|'t) breathe|(?:severe |sudden )?(?:difficulty|trouble) breathing|struggling to breathe|not breathing|unconscious|unresponsive|passed out|won't wake up|severe bleeding|heavy bleeding|uncontrolled bleeding|bleeding (?:a lot|won't stop|will not stop)|(?:face|facial) (?:is )?droop\w*|slurred speech|speech is slurred|sudden (?:one[- ]sided )?weakness|severe allergic reaction|throat (?:is )?swelling|ongoing seizure|seizure (?:won't|will not) stop|overdos(?:e|ed)|took too (?:much|many) (?:medicine|medication|tablets?|pills?)|kill myself|end my life)\b|শ্বাস নিতে পারছি না|বুকে ব্যথা|প্রচণ্ড রক্তপাত|আত্মহত্যা/g
  return text.split(/[.!?;\n]|\bbut\b/).some((clause) => {
    const educational = /\b(?:what (?:is|are)|explain|learn about|definition|general information|symptoms of|signs of)\b/.test(clause)
    const personal = /\b(?:i|i'm|i've|my|we|he|she|they|patient|someone|now|currently)\b|আমার|এখন/.test(clause)
    if (educational && !personal) return false
    // "Find a stroke specialist" does not report a current stroke. A direct
    // symptom statement still takes priority over a simultaneous booking request.
    const reportsCurrentSymptoms = /\b(?:i (?:have|am having|am experiencing|feel)|i'm (?:having|experiencing)|(?:he|she|someone|the patient) (?:has|is having|is experiencing)|my \w+ (?:has|is)|now|currently|right now)\b/.test(clause)
      || /\b(?:can(?:not|'t) breathe|not breathing|unconscious|unresponsive|took too (?:much|many)|kill myself|end my life)\b|শ্বাস নিতে পারছি না|এখন/.test(clause)
    if (/\b(?:last year|years? ago|history of|previously had)\b/.test(clause) && !/\b(?:now|today|currently|again)\b/.test(clause)) return false
    for (const match of clause.matchAll(danger)) {
      const before = clause.slice(Math.max(0, match.index - 45), match.index)
      if (/\b(?:no|without|denies|not having|don't have|do not have|doesn't have|does not have)\s+(?:any\s+)?$/.test(before)) continue
      if (clinicNavigation(clause) && !reportsCurrentSymptoms && /^(?:stroke|heart attack)$/.test(match[0])) continue
      return true
    }
    return false
  })
}

export function medicalSafetyReply(message) {
  const text = normalizedMessage(message)
  if (!text) return null
  if (hasPresentEmergency(text)) {
    return {
      safety: true,
      reply: 'Please seek emergency care now or contact local emergency services. Do not wait for a booking or a chat reply. If someone is nearby, ask them to help. I cannot safely assess these symptoms here.',
      sources: [{ ...EMERGENCY_SOURCE }],
    }
  }

  const askingClinician = /\b(?:questions? (?:to|should i) ask|what should i ask|how (?:do|can|should) i (?:ask|talk to))\b/.test(text)
  const education = /\b(?:what (?:is|are)|explain|define|meaning of)\s+(?:a |an |the )?(?:dose|dosage|prescription|diagnosis)\b/.test(text)
  const doseLanguage = /\b(?:dose|dosage|milligrams?|mg|tablets?|pills?)\b/.test(text)
  const individualDose = (doseLanguage || !clinicNavigation(text)) && (
    /\b(?:how (?:much|many)|what|which|recommend|calculate|give|adjust|increase|decrease|double|change)\b.{0,70}\b(?:dose|dosage|milligrams?|mg|tablets?|pills?|units?|insulin)\b/.test(text)
    || /\b(?:dose|dosage)\s+(?:of|for|should|do|can)\b/.test(text))
  const treatmentQuestions = text.match(/\b(?:should|can|may)\s+(?:i|we|he|she|they|my \w+|the patient)\s+(?:take|stop|start|switch|combine|mix|increase|decrease|double)\b.{0,70}/g) || []
  const individualTreatment = treatmentQuestions.some((question) => !/\b(?:take|stop|start|switch|combine|mix|increase|decrease|double)\s+(?:(?:an?|the|my|this|another|a different)\s+)?(?:appointments?|bookings?|visits?|tests?|chats?|conversations?|assistants?|doctors?|patients?|accounts?|profiles?|browsers?|days?|shifts?|slots?)\b/.test(question))
  const prescribing = /\b(?:prescribe (?:me|for|a|an|some)|(?:write|give|make|recommend)\b.{0,35}\b(?:prescription|treatment plan)|which (?:medicine|medication|antibiotic|drug)\b.{0,35}\b(?:take|use|best)|what (?:medicine|medication|drug) should)\b/.test(text)
  const haveQuestion = text.match(/\b(?:do i|does (?:my \w+|the patient|he|she)) have\s+(.+)/)?.[1]
  const operationalObject = /^(?:(?:an?|the|my|any|some|more|other|upcoming|available|new)\s+)*(?:to\b|appointments?|bookings?|schedules?|availability|patients?|doctors?|slots?|services?|messages?|notifications?|access|permission|accounts?|time\b|breaks?|shifts?)/
  const diagnosis = /\bdiagnose (?:me|my|this|the|a)\b/.test(text)
    || Boolean(haveQuestion && !operationalObject.test(haveQuestion))
  const personalResults = /\b(?:interpret|diagnose|assess)\b.{0,35}\b(?:my|patient|this)\b.{0,35}\b(?:results?|reports?|symptoms?|blood|tests?)\b/.test(text)
  if ((!askingClinician && !education && (individualDose || individualTreatment)) || prescribing || diagnosis || personalResults) {
    return {
      safety: true,
      reply: 'A qualified clinician or pharmacist needs to check the details before advising on a diagnosis, treatment, or medicine dose. I can help you prepare questions for them or find an appointment.',
      sources: [{ title: 'Medicine safety — MedlinePlus', url: 'https://medlineplus.gov/medicationerrors.html' }],
    }
  }
  return null
}
