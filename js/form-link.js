/*
 * Stella Maris College – Event / Activity Entry Form (Google Form) pre-fill.
 *
 * The "Open college form" button opens the college Google Form with the details
 * from this page already filled in. Only the report upload has to be done by hand
 * (Google does not allow file uploads to be pre-filled).
 *
 * The question IDs and option texts below were read from the live form on
 * 30 September 2026 (themes re-checked the same afternoon). If the form's questions or options are edited later, the
 * matching entry here must be updated too (option texts must match exactly).
 */
window.SMC_COLLEGE_FORM = {
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSflu0Fbir4u3gZFNM4Hr53gPt55n1EfqskTfkpJXBsOnZLTjg/viewform',

  entries: {
    academicYear: 298193449,   // multiple choice
    eventName: 669280396,      // paragraph
    startDate: 262322906,      // date
    endDate: 335266505,        // date
    facultyName: 1821325946,   // short answer
    facultyMobile: 1394865608, // short answer
    level: 1225791187,         // multiple choice
    mode: 500331989,           // multiple choice
    departments: 477855335,    // checkboxes
    centres: 357214248,        // checkboxes
    clubs: 712468135,          // checkboxes
    units: 1591071924,         // checkboxes
    mou: 206414522,            // Yes / No
    alumnae: 155922646,        // Yes / No
    fmm150: 118618278,         // Yes / No
    category: 1006737891,      // multiple choice
    theme: 365844882,          // multiple choice
    courseCodes: 1686953332    // short answer
  },

  options: {
    academicYear: ['2024-2025', '2025-2026', '2026-2027'],
    level: ['International', 'National', 'State', 'Regional', 'Institutional', 'Departmental'],
    mode: ['Online', 'Offline', 'Hybrid'],
    yesNo: ['Yes', 'No'],
    departments: [
      'Bioinformatics', 'Biotechnology', 'Botany', 'Business Administration', 'Chemistry',
      'Commerce - General - Shift I', 'Commerce - General - Shift II', 'Commerce - Corporate Secretaryship',
      'Commerce - Accounting & Finance', 'Commerce - Honours',
      'Commerce - Banking, Finance and Entrepreneurship / Professional Accounting',
      'Computer Science', 'Data Science', 'Economics', 'English - Shift I', 'English - Shift II', 'Fine Arts',
      'History', 'Home Science', 'Human Resource Management', 'International Studies',
      'Languages - Tamil', 'Languages - Hindi', 'Languages - French', 'Languages - Sanskrit',
      'Mathematics', 'Physics', 'Psychology', 'Public Relations / Mass Communication',
      'Social Awareness Programme / Service Learning', 'Social Work - UG', 'Social Work - PG', 'Sociology',
      'Value Education', 'Vocational - Banking, Financial Services and Insurance',
      'Vocational - Food Processing and Quality Control', 'Zoology'
    ],
    centres: [
      'Administrative Office', 'Alumnae Association of Stella Maris College (AASMC)', 'Career Guidance Cell (CGC)',
      'Centre for Research in Science and Technology (CRIST) / DST-FIST', 'Centre for Women’s Studies (CWS)',
      'Consortium of Higher Education Institutions for Research and Development (CHIRD)',
      'Entrepreneurship Development Cell (EDC)', 'Industry Connect (ICON)', 'Intellectual Property Rights (IPR) Cell',
      'Internal Committee (IC)', 'Internal Quality Assurance Cell (IQAC)', 'Library', 'Mentoring',
      'Office of the Deans of Academic Affairs', "Office of the Deans of Student Affairs / Students' Union",
      'Shanthi Bhavan Stella Maris Social Welfare Centre', 'Star of the Sea Group (SSG)',
      'Stella Maris Association of Retired Teachers (SMART)',
      'Stella Maris Centre for Development of Resources for Inclusion and Vocational Enrichment (SMCDRIVE)',
      'Stella Maris Centre for Human Resource Development (SMCHRD)',
      'Stella Maris College Extension Project Centre (SMCEPC)', 'Stella Maris College Gender Centre (SMC-GC)',
      'St. Francis of Assisi Centre for Peace Studies', 'SMC Innovation Centre', 'SMC Pathway',
      'Stella Maris Research and International Partnerships Centre (SMRIPC)',
      "Stella Maris Sustainable Development Students' Hub (SMSD)", 'SMC Think Tank'
    ],
    clubs: [
      'Anti Drug Abuse Club', 'BIS Standards', 'Classical Dance', 'Damini', 'Dramatics', 'Enviro Club',
      'Event Management', 'Folk Dance', 'French Club  – Cercle de Francophiles', 'Girl Up',
      'Hindi Club – Anubuthi', 'Light Music', 'Mime & Street Theatre', 'Photography and Film-making',
      'Quiz, Debate & Current Affairs', 'Rotaract Club', 'Sanskrit Club – Kala Kriti', 'Silambam',
      'Stellaeidoscope', 'Storytelling', 'Tamil Club – Bharathi Mandram', 'UNICEF on Campus',
      'Western Music', 'Western Dance'
    ],
    units: [
      'National Cadet Corps (NCC)', 'National Service Scheme (NSS)', 'Physical Education',
      'Red Ribbon Club (RRC)', 'Youth Red Cross (YRC)'
    ],
    category: [
      'Activity for Slow / Advanced / Differential Learners',
      'Administrative Training Programme for Non-Teaching Staff', 'Alumnae Meet', 'Book Discussion',
      'Book Publication (By Faculty / Department)', 'Book Release', 'Campaign',
      'Certificate Course / Value-Added Course',
      'Collaborative Activity [Research, Student (or) Faculty Exchange, Consultancy, Corporate Training for External Agencies]',
      'Competition / Hackathon / Ideathon', 'Conclave / Symposium', 'Conference', 'Cultural Activity',
      'Department Fest', 'Documentary / Movie Screening / Discussion', 'Environmental Activity', 'Exhibition',
      'Experiential Learning [Field trips / Surveys, Industry / Museum / Heritage Site Visits, Nature / Ecology Walks, Hands-on Training, Industry / Rural Immersion, Executive / Job Shadowing, Apprenticeship, Simulation Games, etc.]',
      'Faculty Development Programme (FDP) [Minimum 6 Days]', 'Guest Lecture',
      'Innovation Oriented Outcome-based Activity [Start-ups (Student / Faculty / Department), IPR (Patents, Copyrights etc.)]',
      'OAT Event', 'Orientation / Induction Programme', 'Outreach / Extension Activity', 'Panel Discussion',
      'Participatory Learning [Group / Panel Discussions, Club Activities, Exhibitions, Debates, Poster Presentations, Treasure Hunts, etc.]',
      'Problem Solving [Individual and Group Projects beyond Curriculum, Brainstorming, Critical Analysis, Design / Lateral Thinking, Mind Mapping, Business Plan Competitions, Coding / Debugging Challenges, etc.]',
      'Professional Development Programme for Teaching Staff', 'Religious / Value Education Related Event',
      'Scholar-in-Residence', 'Seminar', 'Service Learning / SAP', 'Signing of Memorandum of Understanding',
      'Sports',
      'Student Support [Mentoring / Counselling, Wellness Sessions / Activities, Career Guidance Sessions / Orientation, Coaching for Competitive Exams, Pathway Programme, etc.]',
      'Workshop'
    ],
    theme: [
      '1.1.3 - Employability (As part of Curriculum)', '1.1.3 - Entrepreneurship (As part of Curriculum)',
      '1.1.3 - Skill Development (As part of Curriculum) - Only Knowledge',
      '1.1.3 - Skill Development (As part of Curriculum) - Knowledge & Practical Skills',
      '1.3.2 - Value-added Course', '1.3.1 - Professional Ethics ( As part of the Curriculum)',
      '1.3.1 - Gender (As part of the Curriculum)', '1.3.1 - Human Values ( As part of the Curriculum)',
      '1.3.1 - Environment and Sustainability (As part of the Curriculum)',
      '2.2.1 - Programme for Slow Learners', '2.2.1 - Programme for Advanced Learners',
      '2.2.1 - Programme for Differential Learners', '2.3.1 - Experiential Learning',
      '2.3.1 - Participatory Learning', '2.3.1 - Problem Solving', '3.3.1 - Innovation',
      '3.3.2 - Research Methodology', '3.3.2 - Intellectual Property Rights (IPR)',
      '3.3.2 - Entrepreneurship (Outside Curriculum)',
      '3.3.2 - Skill Development (Outside Curriculum) - Only Knowledge',
      '3.3.2 - Skill Development (Outside Curriculum) - Knowledge & Practical Skills',
      '3.5.2 - Consultancy / Corporate Training', '3.6.1 - Service Learning / SAP',
      '3.6.3 - Extension / Outreach Programme', '3.7.1 - Research Collaboration',
      '3.7.1 - Industry Collaboration (Lectures from Industry Experts / Collaborative Workshops, Seminars, Conferences / Field Trips, Industry Visits)',
      '3.7.1 - Faculty Exchange Programme', '3.7.1 - Student Exchange Programme',
      '3.7.2 - Activity under MoU (3.7.2)', '5.1.3 - Soft Skills', '5.1.3 - Language and Communication Skills',
      '5.1.3 - Life Skills (Yoga, Physical Fitness, Health and Hygiene etc.)',
      '5.1.3 - Awareness of Trends in Technology', '5.1.4 - Coaching / Guidance for Competitive Exam',
      '5.1.4 - Career Guidance / Counselling', '5.3.3 - Sports Event / Competition',
      '5.3.3 - Cultural Event / Competition', '5.4.1 - Alumnae Engagement Programme',
      '6.3.3 - Professional Development for Teaching & Non-Teaching Staff',
      '7.1.1 - Women Empowerment / Gender Equity',
      '7.1.6 - Beyond the Campus Environmental Promotional Activity',
      '7.1.8 - Inclusion of Cultural / Regional / Linguistic / Communal / Other Diversity',
      '7.1.9 - Transformation of Students to Responsible Citizenship (Constitutional Obligations - Values, Rights, Duties and Responsibilities)',
      '7.1.10 - Programme on Professional Ethics',
      '7.1.11 - National / International Commemorative Days & Festivals',
      '7.2.1 - Sustainability'
    ]
  }
};

(function () {
  'use strict';

  /**
   * v: { academicYear, eventName, startDate (YYYY-MM-DD), endDate, facultyName, facultyMobile,
   *      level, mode, departments: [], centres: [], clubs: [], units: [], mou, alumnae, fmm150,
   *      category, theme, courseCodes }
   */
  function buildPrefillUrl(v) {
    const cfg = window.SMC_COLLEGE_FORM;
    const p = new URLSearchParams();
    p.append('usp', 'pp_url');
    Object.keys(cfg.entries).forEach(function (key) {
      const val = v[key];
      const name = 'entry.' + cfg.entries[key];
      if (Array.isArray(val)) val.forEach(function (x) { if (x) p.append(name, x); });
      else if (val != null && String(val).trim() !== '') p.append(name, String(val).trim());
    });
    return cfg.url + '?' + p.toString();
  }

  /** "2026 – 2027" → "2026-2027" (the form's option format) */
  function academicYearOption(ay) {
    const m = String(ay || '').match(/(\d{4})\D+(\d{4})/);
    return m ? m[1] + '-' + m[2] : '';
  }

  window.SMCForm = { buildPrefillUrl: buildPrefillUrl, academicYearOption: academicYearOption };
})();
