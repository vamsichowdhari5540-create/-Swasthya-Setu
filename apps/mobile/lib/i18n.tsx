import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// Phase 8: Multilingual & Accessibility, on the free stack Expo's own
// localization guide recommends — expo-localization to read the device's
// language, i18n-js to hold and look up the translations. The per-key
// STRINGS table below (one entry per UI string, all three languages side
// by side) is easier to review and keep in sync than i18n-js's own
// per-locale shape, so it stays the source of truth and gets inverted into
// that shape once, below.
export type AppLanguage = 'en' | 'hi' | 'te';

export const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'te', label: 'తెలుగు' },
];

const STRINGS = {
  welcome: { en: 'Welcome', hi: 'स्वागत है', te: 'స్వాగతం' },
  yourNavigation: { en: 'Your navigation', hi: 'आपका मेनू', te: 'మీ మెనూ' },
  signOut: { en: 'Sign out', hi: 'साइन आउट', te: 'సైన్ అవుట్' },
  role_patient: { en: 'Patient', hi: 'मरीज़', te: 'రోగి' },
  role_anm_asha: { en: 'ANM / ASHA Field Worker', hi: 'एएनएम / आशा कार्यकर्ता', te: 'ANM / ఆశా వర్కర్' },
  role_doctor: { en: 'Doctor', hi: 'डॉक्टर', te: 'డాక్టర్' },
  role_district_admin: { en: 'District Admin', hi: 'जिला प्रशासक', te: 'జిల్లా అడ్మిన్' },
  nav_myHealthId: { en: 'My Health ID (QR)', hi: 'मेरी स्वास्थ्य आईडी (QR)', te: 'నా హెల్త్ ఐడీ (QR)' },
  nav_myTimeline: { en: 'My Health Timeline', hi: 'मेरा स्वास्थ्य विवरण', te: 'నా హెల్త్ టైమ్‌లైన్' },
  nav_myConsents: { en: 'Manage Consent', hi: 'सहमति प्रबंधित करें', te: 'సమ్మతిని నిర్వహించండి' },
  nav_myReferrals: { en: 'My Referrals', hi: 'मेरे रेफरल', te: 'నా రిఫరల్స్' },
  nav_registerPatient: { en: 'Register Patient', hi: 'मरीज़ पंजीकृत करें', te: 'రోగిని నమోదు చేయండి' },
  nav_searchPatients: { en: 'Search Patients', hi: 'मरीज़ खोजें', te: 'రోగులను వెతకండి' },
  nav_scanQr: { en: 'Scan Patient QR', hi: 'मरीज़ का QR स्कैन करें', te: 'రోగి QR స్కాన్ చేయండి' },
  nav_sentReferrals: { en: 'Sent Referrals', hi: 'भेजे गए रेफरल', te: 'పంపిన రిఫరల్స్' },
  nav_incomingReferrals: { en: 'Incoming Referrals', hi: 'आने वाले रेफरल', te: 'వచ్చిన రిఫరల్స్' },
  nav_syncStatus: { en: 'Sync Status', hi: 'सिंक स्थिति', te: 'సింక్ స్థితి' },
  nav_dashboard: { en: 'District Dashboard', hi: 'जिला डैशबोर्ड', te: 'జిల్లా డాష్‌బోర్డ్' },

  login_subtitle: { en: 'Sign in to continue', hi: 'जारी रखने के लिए साइन इन करें', te: 'కొనసాగించడానికి సైన్ ఇన్ చేయండి' },
  login_email: { en: 'Email', hi: 'ईमेल', te: 'ఇమెయిల్' },
  login_password: { en: 'Password', hi: 'पासवर्ड', te: 'పాస్‌వర్డ్' },
  login_signIn: { en: 'Sign In', hi: 'साइन इन करें', te: 'సైన్ ఇన్ చేయండి' },
  login_dataAccess: {
    en: 'What data does this app access?',
    hi: 'यह ऐप कौन सा डेटा एक्सेस करता है?',
    te: 'ఈ యాప్ ఏ డేటాను యాక్సెస్ చేస్తుంది?',
  },
  login_demoAccounts: {
    en: 'Demo accounts (password: Demo@1234)',
    hi: 'डेमो खाते (पासवर्ड: Demo@1234)',
    te: 'డెమో ఖాతాలు (పాస్‌వర్డ్: Demo@1234)',
  },
  login_createAccount: { en: 'Create an account', hi: 'खाता बनाएं', te: 'ఖాతా సృష్టించండి' },
  login_forgotPassword: { en: 'Forgot password?', hi: 'पासवर्ड भूल गए?', te: 'పాస్‌వర్డ్ మర్చిపోయారా?' },

  signup_title: { en: 'Create Account', hi: 'खाता बनाएं', te: 'ఖాతా సృష్టించండి' },
  signup_subtitle: {
    en: 'Sign up with your real email — used for sign-in and password reset',
    hi: 'अपने असली ईमेल से साइन अप करें — साइन इन और पासवर्ड रीसेट के लिए उपयोग होगा',
    te: 'మీ నిజమైన ఇమెయిల్‌తో సైన్ అప్ చేయండి — సైన్ ఇన్, పాస్‌వర్డ్ రీసెట్‌కు వాడతాం',
  },
  signup_fullName: { en: 'Full name', hi: 'पूरा नाम', te: 'పూర్తి పేరు' },
  signup_role: { en: 'I am a…', hi: 'मैं हूँ…', te: 'నేను ఒక…' },
  signup_facility: { en: 'Facility', hi: 'सुविधा केंद्र', te: 'ఫెసిలిటీ' },
  signup_facilityHint: {
    en: 'Required for ANM/ASHA and Doctor accounts',
    hi: 'एएनएम/आशा और डॉक्टर खातों के लिए आवश्यक',
    te: 'ANM/ఆశా మరియు డాక్టర్ ఖాతాలకు తప్పనిసరి',
  },
  signup_selectFacility: { en: 'Select a facility', hi: 'सुविधा केंद्र चुनें', te: 'ఫెసిలిటీని ఎంచుకోండి' },
  signup_submit: { en: 'Create Account', hi: 'खाता बनाएं', te: 'ఖాతా సృష్టించండి' },
  signup_alreadyHaveAccount: {
    en: 'Already have an account? Sign in',
    hi: 'पहले से खाता है? साइन इन करें',
    te: 'ఇప్పటికే ఖాతా ఉందా? సైన్ ఇన్ చేయండి',
  },
  signup_checkEmail: {
    en: 'Check your email to confirm your account, then sign in.',
    hi: 'अपना खाता पुष्टि करने के लिए अपना ईमेल देखें, फिर साइन इन करें।',
    te: 'మీ ఖాతాను నిర్ధారించడానికి మీ ఇమెయిల్ చూడండి, తర్వాత సైన్ ఇన్ చేయండి.',
  },
  signup_facilityRequired: {
    en: 'Select a facility for this role.',
    hi: 'इस भूमिका के लिए एक सुविधा केंद्र चुनें।',
    te: 'ఈ పాత్రకు ఒక ఫెసిలిటీని ఎంచుకోండి.',
  },

  forgot_title: { en: 'Reset your password', hi: 'अपना पासवर्ड रीसेट करें', te: 'మీ పాస్‌వర్డ్ రీసెట్ చేయండి' },
  forgot_subtitle: {
    en: "Enter your email and we'll send you a reset link",
    hi: 'अपना ईमेल दर्ज करें, हम आपको एक रीसेट लिंक भेजेंगे',
    te: 'మీ ఇమెయిల్ ఇవ్వండి, మేము రీసెట్ లింక్ పంపుతాము',
  },
  forgot_submit: { en: 'Send reset link', hi: 'रीसेट लिंक भेजें', te: 'రీసెట్ లింక్ పంపండి' },
  forgot_sent: {
    en: 'If an account exists for that email, a reset link is on its way. Check your inbox.',
    hi: 'यदि उस ईमेल के लिए कोई खाता है, तो रीसेट लिंक भेजा जा रहा है। अपना इनबॉक्स देखें।',
    te: 'ఆ ఇమెయిల్‌కు ఖాతా ఉంటే, రీసెట్ లింక్ పంపబడుతోంది. మీ ఇన్‌బాక్స్ చూడండి.',
  },
  forgot_backToSignIn: { en: 'Back to sign in', hi: 'साइन इन पर वापस जाएं', te: 'సైన్ ఇన్‌కు తిరిగి వెళ్లండి' },

  reset_title: { en: 'Set a new password', hi: 'नया पासवर्ड सेट करें', te: 'కొత్త పాస్‌వర్డ్ సెట్ చేయండి' },
  reset_newPassword: { en: 'New password', hi: 'नया पासवर्ड', te: 'కొత్త పాస్‌వర్డ్' },
  reset_submit: { en: 'Update password', hi: 'पासवर्ड अपडेट करें', te: 'పాస్‌వర్డ్ అప్‌డేట్ చేయండి' },
  reset_success: {
    en: 'Password updated. You can sign in now.',
    hi: 'पासवर्ड अपडेट हो गया। अब आप साइन इन कर सकते हैं।',
    te: 'పాస్‌వర్డ్ అప్‌డేట్ అయ్యింది. ఇప్పుడు మీరు సైన్ ఇన్ చేయవచ్చు.',
  },
  reset_invalidLink: {
    en: 'This reset link is invalid or has expired. Request a new one.',
    hi: 'यह रीसेट लिंक अमान्य है या समाप्त हो गया है। एक नया अनुरोध करें।',
    te: 'ఈ రీసెట్ లింక్ చెల్లదు లేదా గడువు ముగిసింది. కొత్తది అభ్యర్థించండి.',
  },
  reset_webOnly: {
    en: 'Open the link from your email in a web browser to reset your password.',
    hi: 'अपना पासवर्ड रीसेट करने के लिए अपने ईमेल का लिंक वेब ब्राउज़र में खोलें।',
    te: 'మీ పాస్‌వర్డ్ రీసెట్ చేయడానికి మీ ఇమెయిల్‌లోని లింక్‌ను వెబ్ బ్రౌజర్‌లో తెరవండి.',
  },

  register_fullName: { en: 'Full name', hi: 'पूरा नाम', te: 'పూర్తి పేరు' },
  register_fullNameHint: {
    en: "Step 1 of 3 — the patient's full name, as they'd say it themselves",
    hi: 'चरण 1/3 — मरीज़ का पूरा नाम, जैसे वे खुद बताएं',
    te: 'దశ 1/3 — రోగి పూర్తి పేరు, వారు స్వయంగా చెప్పినట్లు',
  },
  register_dob: { en: 'Date of birth', hi: 'जन्म तिथि', te: 'పుట్టిన తేదీ' },
  register_dobHint: {
    en: 'Step 2 of 3 — format: YYYY-MM-DD, e.g. 1990-05-14',
    hi: 'चरण 2/3 — प्रारूप: YYYY-MM-DD, जैसे 1990-05-14',
    te: 'దశ 2/3 — ఫార్మాట్: YYYY-MM-DD, ఉదా. 1990-05-14',
  },
  register_sex: { en: 'Sex', hi: 'लिंग', te: 'లింగం' },
  register_sexHint: { en: 'Step 3 of 3 — tap one', hi: 'चरण 3/3 — एक चुनें', te: 'దశ 3/3 — ఒకటి నొక్కండి' },
  register_submit: { en: 'Register Patient', hi: 'मरीज़ पंजीकृत करें', te: 'రోగిని నమోదు చేయండి' },
  sex_female: { en: 'female', hi: 'महिला', te: 'స్త్రీ' },
  sex_male: { en: 'male', hi: 'पुरुष', te: 'పురుషుడు' },
  sex_other: { en: 'other', hi: 'अन्य', te: 'ఇతర' },

  search_placeholder: {
    en: 'Search by name or health ID',
    hi: 'नाम या स्वास्थ्य आईडी से खोजें',
    te: 'పేరు లేదా హెల్త్ ఐడీ ద్వారా వెతకండి',
  },
  search_noResults: { en: 'No patients match', hi: 'कोई मरीज़ नहीं मिला', te: 'ఏ రోగి సరిపోలలేదు' },

  scan_title: { en: 'Point the camera at a patient QR code', hi: 'मरीज़ के QR कोड पर कैमरा रखें', te: 'రోగి QR కోడ్ వైపు కెమెరా చూపండి' },
  scan_permission: {
    en: 'Camera permission is needed to scan a QR code.',
    hi: 'QR कोड स्कैन करने के लिए कैमरा अनुमति आवश्यक है।',
    te: 'QR కోడ్ స్కాన్ చేయడానికి కెమెరా అనుమతి అవసరం.',
  },
  scan_grant: { en: 'Grant camera permission', hi: 'कैमरा अनुमति दें', te: 'కెమెరా అనుమతి ఇవ్వండి' },

  sync_title: { en: 'Sync Status', hi: 'सिंक स्थिति', te: 'సింక్ స్థితి' },
  sync_empty: { en: 'Nothing queued — everything is synced.', hi: 'कुछ भी लंबित नहीं है — सब सिंक हो गया।', te: 'ఏమీ పెండింగ్‌లో లేదు — అంతా సింక్ అయింది.' },
  sync_retry: { en: 'Retry', hi: 'फिर से कोशिश करें', te: 'మళ్లీ ప్రయత్నించండి' },

  referral_receivingFacility: { en: 'Receiving facility', hi: 'प्राप्तकर्ता सुविधा', te: 'స్వీకరించే సదుపాయం' },
  referral_reason: { en: 'Reason for referral', hi: 'रेफरल का कारण', te: 'రిఫరల్ కారణం' },
  referral_reasonHint: {
    en: 'Speak or type: why does this patient need to be seen elsewhere?',
    hi: 'बोलें या टाइप करें: इस मरीज़ को कहीं और क्यों देखा जाना चाहिए?',
    te: 'మాట్లాడండి లేదా టైప్ చేయండి: ఈ రోగిని వేరే చోట ఎందుకు చూడాలి?',
  },
  referral_submit: { en: 'Create Referral', hi: 'रेफरल बनाएं', te: 'రిఫరల్ సృష్టించండి' },

  title_signIn: { en: 'Sign In', hi: 'साइन इन करें', te: 'సైన్ ఇన్ చేయండి' },
  title_signUp: { en: 'Create Account', hi: 'खाता बनाएं', te: 'ఖాతా సృష్టించండి' },
  title_forgotPassword: { en: 'Reset Password', hi: 'पासवर्ड रीसेट करें', te: 'పాస్‌వర్డ్ రీసెట్ చేయండి' },
  title_consent: { en: 'Privacy & Consent', hi: 'गोपनीयता और सहमति', te: 'గోప్యత & సమ్మతి' },
  title_myAudit: { en: 'My Audit Log', hi: 'मेरा ऑडिट लॉग', te: 'నా ఆడిట్ లాగ్' },
  title_scanQr: { en: 'Scan QR Code', hi: 'QR कोड स्कैन करें', te: 'QR కోడ్ స్కాన్ చేయండి' },
  title_patient: { en: 'Patient', hi: 'मरीज़', te: 'రోగి' },
  title_referral: { en: 'Referral', hi: 'रेफरल', te: 'రిఫరల్' },
  title_consultation: { en: 'Consultation', hi: 'टेलीकंसल्ट', te: 'టెలికన్సల్ట్' },
  title_aiSummary: { en: 'AI Summary', hi: 'एआई सारांश', te: 'AI సారాంశం' },

  patient_dob: { en: 'Date of birth', hi: 'जन्म तिथि', te: 'పుట్టిన తేదీ' },
  patient_sex: { en: 'Sex', hi: 'लिंग', te: 'లింగం' },
  patient_referButton: { en: 'Refer this patient', hi: 'इस मरीज़ को रेफर करें', te: 'ఈ రోగిని రిఫర్ చేయండి' },
  patient_aiSummaryButton: { en: 'AI Summary', hi: 'एआई सारांश', te: 'AI సారాంశం' },
  patient_recordVisit: { en: 'Record a visit', hi: 'विज़िट दर्ज करें', te: 'విజిట్ నమోదు చేయండి' },
  patient_recordVisitHint: {
    en: 'Speak or type what happened at this visit',
    hi: 'इस विज़िट में क्या हुआ, बोलें या टाइप करें',
    te: 'ఈ విజిట్‌లో ఏమి జరిగిందో మాట్లాడండి లేదా టైప్ చేయండి',
  },
  patient_saveVisit: { en: 'Save Visit', hi: 'विज़िट सहेजें', te: 'విజిట్ సేవ్ చేయండి' },
  patient_timeline: { en: 'Timeline', hi: 'समयरेखा', te: 'టైమ్‌లైన్' },
  patient_noVisits: { en: 'No visits recorded yet.', hi: 'अभी तक कोई विज़िट दर्ज नहीं है।', te: 'ఇంకా ఏ విజిట్ నమోదు కాలేదు.' },
  patient_waitingSync: { en: 'Waiting to sync', hi: 'सिंक होने की प्रतीक्षा में', te: 'సింక్ కోసం వేచి ఉంది' },
  patient_failedSync: { en: 'Failed to sync', hi: 'सिंक विफल', te: 'సింక్ విఫలమైంది' },

  accept: { en: 'Accept Referral', hi: 'रेफरल स्वीकार करें', te: 'రిఫరల్ ఆమోదించండి' },
  cancel: { en: 'Cancel Referral', hi: 'रेफरल रद्द करें', te: 'రిఫరల్ రద్దు చేయండి' },
  reassign: { en: 'Reassign', hi: 'पुनः असाइन करें', te: 'తిరిగి కేటాయించండి' },
  markCompleted: { en: 'Mark Completed', hi: 'पूर्ण के रूप में चिह्नित करें', te: 'పూర్తయినట్లు గుర్తించండి' },

  list_incoming: { en: 'Incoming Referrals', hi: 'आने वाले रेफरल', te: 'వచ్చిన రిఫరల్స్' },
  list_outgoing: { en: 'Sent Referrals', hi: 'भेजे गए रेफरल', te: 'పంపిన రిఫరల్స్' },
  list_mine: { en: 'My Referrals', hi: 'मेरे रेफरल', te: 'నా రిఫరల్స్' },
  list_empty: { en: 'Nothing here yet.', hi: 'यहाँ अभी कुछ नहीं है।', te: 'ఇక్కడ ఇంకా ఏమీ లేదు.' },

  dash_totals: { en: 'Totals', hi: 'कुल', te: 'మొత్తాలు' },
  dash_facilities: { en: 'Facilities', hi: 'सुविधाएँ', te: 'సదుపాయాలు' },
  dash_patients: { en: 'Patients', hi: 'मरीज़', te: 'రోగులు' },
  dash_referrals: { en: 'Referrals', hi: 'रेफरल', te: 'రిఫరల్స్' },
  dash_byStatus: { en: 'Referrals by status', hi: 'स्थिति के अनुसार रेफरल', te: 'స్థితి వారీగా రిఫరల్స్' },
  dash_avgAccept: { en: 'Avg. time to accept', hi: 'स्वीकृति का औसत समय', te: 'ఆమోదించడానికి సగటు సమయం' },
  dash_facilityLoad: { en: 'Facility load', hi: 'सुविधा भार', te: 'సదుపాయం లోడ్' },
  dash_auditActivity: { en: 'Audit activity', hi: 'ऑडिट गतिविधि', te: 'ఆడిట్ కార్యకలాపం' },

  summary_generate: { en: 'Generate AI Summary', hi: 'एआई सारांश बनाएं', te: 'AI సారాంశం రూపొందించండి' },
  summary_saveEdit: { en: 'Save edit', hi: 'संपादन सहेजें', te: 'ఎడిట్ సేవ్ చేయండి' },
  summary_approve: { en: 'Approve', hi: 'स्वीकृत करें', te: 'ఆమోదించండి' },
  summary_none: { en: 'No summaries yet.', hi: 'अभी तक कोई सारांश नहीं।', te: 'ఇంకా సారాంశాలు లేవు.' },

  call_endCall: { en: 'End Call', hi: 'कॉल समाप्त करें', te: 'కాల్ ముగించండి' },

  referral_completeTitle: { en: 'Complete referral', hi: 'रेफरल पूर्ण करें', te: 'రిఫరల్ పూర్తి చేయండి' },
  referral_outcomeNotes: { en: 'Outcome notes (optional)', hi: 'परिणाम टिप्पणी (वैकल्पिक)', te: 'ఫలిత గమనికలు (ఐచ్ఛికం)' },
  referral_reassignTitle: {
    en: 'Reassign to another facility',
    hi: 'किसी अन्य सुविधा को पुनः असाइन करें',
    te: 'మరొక సదుపాయానికి తిరిగి కేటాయించండి',
  },
  teleconsult_title: { en: 'Teleconsultation', hi: 'टेलीकंसल्टेशन', te: 'టెలికన్సల్టేషన్' },
  teleconsult_start: { en: 'Start Teleconsultation', hi: 'टेलीकंसल्टेशन शुरू करें', te: 'టెలికన్సల్టేషన్ ప్రారంభించండి' },
  teleconsult_join: { en: 'Join Consultation', hi: 'परामर्श में शामिल हों', te: 'కన్సల్టేషన్‌లో చేరండి' },
  teleconsult_video: { en: 'Video', hi: 'वीडियो', te: 'వీడియో' },
  teleconsult_audio: { en: 'Audio only', hi: 'केवल ऑडियो', te: 'ఆడియో మాత్రమే' },
  teleconsult_inProgress: { en: 'Call in progress.', hi: 'कॉल जारी है।', te: 'కాల్ కొనసాగుతోంది.' },

  consent_hint: {
    en: "Your home facility always has access. Grant other facilities access below — for example one you've been referred to — and revoke it whenever you want.",
    hi: 'आपकी गृह सुविधा को हमेशा पहुंच है। नीचे अन्य सुविधाओं को पहुंच दें — जैसे जिसे आपको रेफर किया गया हो — और जब चाहें इसे रद्द करें।',
    te: 'మీ హోమ్ ఫెసిలిటీకి ఎల్లప్పుడూ యాక్సెస్ ఉంటుంది. కింద ఇతర సదుపాయాలకు యాక్సెస్ ఇవ్వండి — ఉదాహరణకు మీరు రిఫర్ చేయబడిన ఒకటి — మరియు మీకు కావలసినప్పుడు దాన్ని రద్దు చేయండి.',
  },
  consent_facilitiesWithAccess: { en: 'Facilities with access', hi: 'पहुंच वाली सुविधाएँ', te: 'యాక్సెస్ ఉన్న సదుపాయాలు' },
  consent_noOtherFacility: {
    en: 'No facility other than your home facility has access.',
    hi: 'आपकी गृह सुविधा के अलावा किसी अन्य को पहुंच नहीं है।',
    te: 'మీ హోమ్ ఫెసిలిటీ తప్ప మరే సదుపాయానికి యాక్సెస్ లేదు.',
  },
  consent_revokeAccess: { en: 'Revoke access', hi: 'पहुंच रद्द करें', te: 'యాక్సెస్ రద్దు చేయండి' },
  consent_grantAccessTitle: { en: 'Grant access', hi: 'पहुंच दें', te: 'యాక్సెస్ ఇవ్వండి' },
  consent_allHaveAccess: {
    en: 'Every known facility already has access.',
    hi: 'हर ज्ञात सुविधा के पास पहले से ही पहुंच है।',
    te: 'ప్రతి తెలిసిన సదుపాయానికి ఇప్పటికే యాక్సెస్ ఉంది.',
  },
  consent_grantAccess: { en: 'Grant access', hi: 'पहुंच दें', te: 'యాక్సెస్ ఇవ్వండి' },
  consent_viewAuditLog: { en: 'View my audit log', hi: 'मेरा ऑडिट लॉग देखें', te: 'నా ఆడిట్ లాగ్ చూడండి' },

  audit_viewPatient: { en: 'Record viewed', hi: 'रिकॉर्ड देखा गया', te: 'రికార్డ్ చూడబడింది' },
  audit_createEncounter: { en: 'Visit recorded', hi: 'विज़िट दर्ज की गई', te: 'విజిట్ నమోదైంది' },
  audit_grantConsent: { en: 'Consent granted', hi: 'सहमति दी गई', te: 'సమ్మతి ఇవ్వబడింది' },
  audit_revokeConsent: { en: 'Consent revoked', hi: 'सहमति रद्द की गई', te: 'సమ్మతి రద్దు చేయబడింది' },
  audit_generateSummary: { en: 'AI summary generated', hi: 'एआई सारांश बनाया गया', te: 'AI సారాంశం రూపొందించబడింది' },
  audit_editSummary: { en: 'AI summary edited', hi: 'एआई सारांश संपादित', te: 'AI సారాంశం సవరించబడింది' },
  audit_approveSummary: { en: 'AI summary approved', hi: 'एआई सारांश स्वीकृत', te: 'AI సారాంశం ఆమోదించబడింది' },
  audit_createReferral: { en: 'Referral created', hi: 'रेफरल बनाया गया', te: 'రిఫరల్ సృష్టించబడింది' },
  audit_acceptReferral: { en: 'Referral accepted', hi: 'रेफरल स्वीकार किया गया', te: 'రిఫరల్ ఆమోదించబడింది' },
  audit_completeReferral: { en: 'Referral completed', hi: 'रेफरल पूरा हुआ', te: 'రిఫరల్ పూర్తయింది' },
  audit_reassignReferral: { en: 'Referral reassigned', hi: 'रेफरल पुनः असाइन किया गया', te: 'రిఫరల్ తిరిగి కేటాయించబడింది' },
  audit_cancelReferral: { en: 'Referral cancelled', hi: 'रेफरल रद्द किया गया', te: 'రిఫరల్ రద్దు చేయబడింది' },
  audit_empty: { en: 'No recorded access yet.', hi: 'अभी तक कोई पहुंच दर्ज नहीं है।', te: 'ఇంకా యాక్సెస్ నమోదు కాలేదు.' },

  healthid_hint: {
    en: 'Show this to a field worker or doctor to let them find your record.',
    hi: 'अपना रिकॉर्ड खोजने के लिए इसे किसी फील्ड वर्कर या डॉक्टर को दिखाएं।',
    te: 'మీ రికార్డును కనుగొనడానికి దీన్ని ఫీల్డ్ వర్కర్ లేదా డాక్టర్‌కు చూపించండి.',
  },

  voice_speak: { en: 'Tap to speak', hi: 'बोलने के लिए दबाएं', te: 'మాట్లాడటానికి నొక్కండి' },
  voice_listening: { en: 'Listening…', hi: 'सुन रहा है…', te: 'వింటోంది…' },
  voice_webOnly: {
    en: 'Voice input works in the web version of this app only, in this build.',
    hi: 'इस बिल्ड में आवाज़ इनपुट केवल इस ऐप के वेब संस्करण में काम करता है।',
    te: 'ఈ బిల్డ్‌లో వాయిస్ ఇన్‌పుట్ ఈ యాప్ యొక్క వెబ్ వెర్షన్‌లో మాత్రమే పనిచేస్తుంది.',
  },
} as const;

export type StringKey = keyof typeof STRINGS;

// i18n-js wants { locale: { key: value } }, the opposite axis from STRINGS
// above — inverted once at module load rather than hand-duplicated.
const TRANSLATIONS = LANGUAGES.reduce<Record<AppLanguage, Record<string, string>>>(
  (acc, { code }) => {
    acc[code] = Object.fromEntries(Object.entries(STRINGS).map(([key, values]) => [key, values[code]]));
    return acc;
  },
  {} as Record<AppLanguage, Record<string, string>>
);

const i18n = new I18n(TRANSLATIONS);
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

function detectDeviceLanguage(): AppLanguage {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;
  return LANGUAGES.some((l) => l.code === deviceLanguageCode) ? (deviceLanguageCode as AppLanguage) : 'en';
}

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: StringKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Defaults to the device's own language when it's one we support (per
  // the Free stack's "device/platform" framing), English otherwise. Not
  // persisted across restarts beyond that — a deliberately scoped slice of
  // Phase 8, same as before; see README.
  const [language, setLanguageState] = useState<AppLanguage>(detectDeviceLanguage);

  const value = useMemo<LanguageContextValue>(() => {
    i18n.locale = language;
    return {
      language,
      setLanguage: setLanguageState,
      t: (key) => i18n.t(key),
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
