// Design Ref: copy.md ★ Recommended (Option A) — do not alter wording without updating copy.md
import type { Dictionary } from './types'

export const en: Dictionary = {
  meta: {
    title: 'Find Korean Partners — Connect with trusted Korean companies',
    description:
      "Tell us what you're looking for in Korea. We help you discover, compare, and connect with trusted Korean companies, education providers, and service partners.",
  },
  header: {
    logo: 'Find Korean Partners',
    requestNav: 'Request',
    languageSwitcher: {
      en: 'EN',
      ja: 'JA',
      switchWarning: 'Switching language will clear your in-progress request. Continue?',
    },
  },
  hero: {
    headline: 'Find the right Korean partner for your business.',
    subheadline:
      'Tell us what you are looking for in Korea. We help you discover, compare, and connect with trusted Korean companies, education providers, and service partners.',
    ctaText: 'Start My Request',
  },
  howItWorks: {
    title: 'How It Works',
    steps: [
      {
        title: 'Submit Request',
        description: 'Tell us what kind of Korean partner you are looking for.',
      },
      {
        title: 'We Research',
        description: 'We look for Korean companies that match your request.',
      },
      {
        title: 'Get Shortlist',
        description: 'We send you a comparison of the best-fit candidates.',
      },
      {
        title: 'We Connect',
        description: 'We help set up meetings and communication with your chosen partner.',
      },
    ],
  },
  categories: {
    title: 'Categories',
    selectHint: 'Start a request in this category',
    items: {
      education: {
        name: 'Education & EdTech',
        keywords: ['Korean language education', 'AI & coding education', 'Career counseling', 'LMS & e-learning'],
      },
      'it-ai': {
        name: 'IT & AI',
        keywords: ['Web & app development', 'AI automation', 'Chatbots', 'SaaS platforms'],
      },
      'content-media': {
        name: 'Content & Media',
        keywords: ['Video production', 'Short-form content', 'Design & branding', 'Translation & localization'],
      },
      'beauty-lifestyle': {
        name: 'Beauty & Lifestyle',
        keywords: ['K-beauty products', 'Lifestyle goods', 'Brand partnerships', 'Manufacturing & sourcing'],
      },
      'business-services': {
        name: 'Business Services',
        keywords: ['Marketing & PR', 'Market research', 'Korea market entry', 'Consulting'],
      },
    },
  },
  whyUs: {
    title: 'Why Find Korean Partners',
    points: [
      {
        title: 'We Understand Your Needs',
        description:
          'We take time to clarify your request before searching for partners. This means better matches, not just a long list.',
      },
      {
        title: 'Curated, Not Just Listed',
        description:
          "We research and compare candidates so you don't have to. You get a short, relevant list with clear recommendations.",
      },
      {
        title: 'Support Beyond Introductions',
        description:
          'If needed, we help schedule meetings and support communication between you and your Korean partner.',
      },
    ],
  },
  requestForm: {
    selectPlaceholder: 'Select an option',
    step1: {
      label: "Step 1 of 3 — What You're Looking For",
      whatLookingFor: {
        label: 'What are you looking for in Korea?',
        placeholder: 'e.g., A Korean EdTech company for AI curriculum licensing',
      },
      category: {
        label: 'Which category best fits your request?',
      },
    },
    step2: {
      label: 'Step 2 of 3 — Details',
      partnerType: {
        label: 'What type of partner do you need?',
        options: {
          purchase: 'Purchase a product or service',
          partnership: 'Business partnership',
          license: 'License content or technology',
          other: 'Other',
        },
      },
      purpose: {
        label: 'What is your purpose?',
        placeholder: 'e.g., Licensing curriculum for our online platform',
      },
      description: {
        label: 'Please describe your request.',
        placeholder: "Tell us more about your business and what you're looking for.",
      },
      budget: {
        label: 'What is your budget range?',
        options: {
          'under-500': 'Under $500',
          '500-1500': '$500–$1,500',
          '1500-3000': '$1,500–$3,000',
          'over-3000': 'Over $3,000',
          'not-sure': 'Not sure yet',
        },
      },
      timeline: {
        label: 'What is your timeline?',
        options: {
          asap: 'As soon as possible',
          'within-1-month': 'Within 1 month',
          '1-3-months': '1–3 months',
          '3-6-months': '3–6 months',
          flexible: 'Flexible',
        },
      },
      englishSpeaking: {
        label: 'Do you need English-speaking Korean partners?',
        options: {
          required: 'Required',
          preferred: 'Preferred, but not required',
          'not-needed': 'Not needed',
        },
      },
    },
    step3: {
      label: 'Step 3 of 3 — Contact Info',
      companyNameWebsite: {
        label: 'Your company name / website',
        placeholder: 'e.g., Acme Inc. / https://acme.example.com',
      },
      contact: {
        label: 'Contact information',
        placeholder: 'Your email address',
      },
      consent: {
        privacy: { before: 'I agree to the ', linkText: 'Privacy Policy', after: '.' },
        terms: { before: 'I agree to the ', linkText: 'Terms of Service', after: '.' },
        marketingLabel: '(Optional) I want to receive occasional updates by email.',
      },
    },
    buttons: {
      next: 'Next',
      back: 'Back',
      submit: 'Submit Request',
      submitting: 'Submitting...',
      retry: 'Retry',
      startNew: 'Start a New Request',
    },
    validation: {
      required: 'This field is required.',
      invalidEmail: 'Please enter a valid email address.',
      consentRequired: 'Please agree to the Privacy Policy and Terms of Service to continue.',
    },
    status: {
      success: "Thank you! We've received your request and will get back to you soon.",
      error: 'Something went wrong. Please try again.',
    },
    recap: {
      step1Label: 'Your request',
      step2Label: 'Details',
      editLabel: 'Edit',
    },
    confirmModal: {
      title: 'Please confirm your request',
      description: "We'll submit the request below. Please review before continuing.",
      sections: { step1: "What you're looking for", step2: 'Details', step3: 'Contact' },
      confirmButton: 'Confirm & Submit',
      cancelButton: 'Cancel',
    },
  },
  requestPage: {
    intro: "Tell us what you're looking for in Korea, and we'll connect you with the right partner.",
  },
  footer: {
    intro: 'Find Korean Partners helps global companies connect with trusted Korean education, IT, content, and service partners.',
    contactEmail: 'jhc@ylia.io',
    privacyLinkText: 'Privacy Policy',
    termsLinkText: 'Terms of Service',
  },
  legal: {
    backToHome: '← Back to Find Korean Partners',
  },
  cookieConsent: {
    before: 'We use cookies for analytics to improve this site. See our ',
    linkText: 'Privacy Policy',
    after: ' for details.',
    accept: 'Accept',
    decline: 'Decline',
  },
}
