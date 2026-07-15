export const treatments = [
  {
    slug: 'ivf',
    name: 'In Vitro Fertilization (IVF)',
    shortDescription: 'The gold standard in fertility treatment, assisting with fertilization, embryo development, and implantation.',
    description: 'In Vitro Fertilization (IVF) is a complex series of procedures used to help with fertility or prevent genetic problems and assist with the conception of a child. During IVF, mature eggs are collected from ovaries and fertilized by sperm in a lab.',
    whoItMayHelp: 'Couples with fallopian tube damage, ovulation disorders, endometriosis, or unexplained infertility.',
    typicalProcess: [
      'Ovarian Stimulation',
      'Egg Retrieval',
      'Sperm Retrieval',
      'Fertilization',
      'Embryo Transfer'
    ],
    faqs: [
      {
        question: 'How long does one cycle of IVF take?',
        answer: 'A single cycle of IVF typically takes about three weeks. However, sometimes these steps are split into different parts and the process can take longer.'
      }
    ]
  },
  {
    slug: 'icsi',
    name: 'Intracytoplasmic Sperm Injection (ICSI)',
    shortDescription: 'A specialized form of IVF used primarily to overcome severe male infertility issues.',
    description: 'ICSI is an advanced micromanipulation technique used alongside IVF. Instead of mixing sperm and egg in a dish, a single healthy sperm is carefully selected and injected directly into the center of the egg to achieve fertilization.',
    whoItMayHelp: 'Couples dealing with low sperm count, poor sperm motility, or structural issues preventing sperm from reaching the egg.',
    typicalProcess: [
      'Sperm Collection & Preparation',
      'Egg Retrieval',
      'Direct Injection of Sperm',
      'Embryo Development Monitoring',
      'Embryo Transfer'
    ],
    faqs: [
      {
        question: 'Is ICSI always necessary?',
        answer: 'Not always. It is generally recommended when there are known male-factor infertility issues or if previous standard IVF attempts have resulted in low fertilization rates.'
      }
    ]
  },
  {
    slug: 'egg-freezing',
    name: 'Egg Freezing',
    shortDescription: 'Preserve your fertility potential for the future by harvesting and freezing unfertilized eggs.',
    description: 'Also known as mature oocyte cryopreservation, egg freezing is a method used to save women\'s ability to get pregnant in the future. Eggs harvested from your ovaries are frozen unfertilized and stored for later use.',
    whoItMayHelp: 'Women wishing to delay childbearing for personal, professional, or medical reasons (such as impending cancer treatments).',
    typicalProcess: [
      'Ovarian Stimulation',
      'Monitoring via Ultrasound',
      'Egg Retrieval',
      'Cryopreservation (Freezing)'
    ],
    faqs: [
      {
        question: 'How long can eggs be frozen?',
        answer: 'Eggs can be frozen indefinitely without significant degradation in quality. The chances of success rely heavily on the age at which the eggs were frozen.'
      }
    ]
  },
  {
    slug: 'embryo-freezing',
    name: 'Embryo Freezing',
    shortDescription: 'Cryopreservation of fertilized eggs for future use or multiple attempts.',
    description: 'Embryo freezing involves preserving embryos (fertilized eggs) that are not transferred during an initial IVF cycle. This allows for future embryo transfers without the need to undergo ovarian stimulation and egg retrieval again.',
    whoItMayHelp: 'Couples undergoing IVF who produce multiple viable embryos, or those looking to preserve fertility as a couple.',
    typicalProcess: [
      'IVF/ICSI Cycle',
      'Embryo Development',
      'Vitrification (Rapid Freezing)',
      'Storage',
      'Future Thawing and Transfer'
    ],
    faqs: [
      {
        question: 'Is the success rate different with frozen embryos?',
        answer: 'Many modern clinics actually see similar or sometimes even higher success rates with frozen embryo transfers, as the woman\'s body has time to recover from the stimulation medications before the transfer.'
      }
    ]
  },
  {
    slug: 'donor-programs',
    name: 'Donor Programs',
    shortDescription: 'Paths to parenthood utilizing donor eggs, sperm, or embryos.',
    description: 'Donor programs offer alternatives for individuals or couples who are unable to conceive using their own gametes. Our partner clinics offer comprehensive screening processes for donors to ensure the highest standards of safety and health.',
    whoItMayHelp: 'Individuals or couples with severe premature ovarian failure, severe male-factor infertility, genetic conditions they wish not to pass on, and LGBTQ+ couples.',
    typicalProcess: [
      'Donor Selection & Matching',
      'Legal and Psychological Counseling',
      'Cycle Synchronization (if using fresh eggs)',
      'IVF/ICSI using Donor Material',
      'Embryo Transfer'
    ],
    faqs: [
      {
        question: 'Are the donors anonymous?',
        answer: 'Different legal jurisdictions have different rules. In Bangalore, our partner clinics follow rigorous ICMR guidelines regarding anonymity and medical screening of donors.'
      }
    ]
  },
  {
    slug: 'fertility-preservation',
    name: 'Fertility Preservation',
    shortDescription: 'Proactive medical interventions to protect fertility before medical treatments.',
    description: 'Fertility preservation includes procedures that help individuals retain their ability to have children, particularly those facing medical treatments like chemotherapy or radiation that may compromise fertility.',
    whoItMayHelp: 'Oncology patients, individuals undergoing reproductive surgeries, or those managing autoimmune diseases with gonadotoxic medications.',
    typicalProcess: [
      'Urgent Consultation',
      'Expedited Stimulation Protocol',
      'Egg/Sperm/Embryo Retrieval',
      'Cryopreservation',
      'Commencement of Medical Treatment'
    ],
    faqs: [
      {
        question: 'Can this be done quickly before starting chemotherapy?',
        answer: 'Yes. Our partner clinics understand the urgency of onco-fertility and can often expedite the stimulation protocols to ensure minimal delay to your primary medical treatments.'
      }
    ]
  }
];