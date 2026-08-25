window.AB_CRM_TEMPLATES = {
  signature: '\n\nCordialement,\n\nA&B Technologies\nCréer. Développer. Faire grandir.',
  general_email(c) {
    return { subject: `A&B Technologies — Votre demande ${c.reference}`, body: `Bonjour ${c.first_name},\n\n` };
  },
  appointment_proposal(c, slots = []) {
    const lines = slots.map((s) => `• ${new Date(s.startsAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}`).join('\n');
    return { subject: `A&B Technologies — Proposition de rendez-vous ${c.reference}`,
      body: `Bonjour ${c.first_name},\n\nMerci pour votre demande concernant votre projet.\n\nAfin de mieux comprendre votre besoin, nous souhaitons vous proposer un échange à distance.\n\nVoici les créneaux disponibles :\n${lines || '• À définir'}\n\nVous pouvez simplement répondre à cet email en nous indiquant le créneau qui vous convient le mieux.` };
  },
  information_request(c, items = []) {
    return { subject: `A&B Technologies — Informations complémentaires ${c.reference}`,
      body: `Bonjour ${c.first_name},\n\nAfin de poursuivre l’analyse de votre projet, pourriez-vous nous transmettre les éléments suivants :\n${items.map(x=>`• ${x}`).join('\n')}\n\nVous pouvez répondre directement à cet email.` };
  },
  quote(c, q = {}) {
    return { subject: `A&B Technologies — Devis ${q.reference || ''} pour ${c.reference}`,
      body: `Bonjour ${c.first_name},\n\nÀ la suite de l’étude de votre demande et de nos échanges, vous trouverez ci-joint notre proposition commerciale pour votre projet.\n\nMontant : ${q.amount || '—'} ${q.currency || 'XOF'}\nDélai estimé : ${q.estimated_duration || '—'}\n\nSi cette proposition vous convient, vous pouvez simplement répondre à cet email.` };
  },
  follow_up(c, context = 'general') {
    const text = context === 'appointment'
      ? 'Nous revenons vers vous concernant notre proposition de rendez-vous pour votre projet.\n\nN’hésitez pas à nous indiquer le créneau qui vous convient.'
      : context === 'quote'
        ? 'Nous revenons vers vous concernant le devis transmis pour votre projet.\n\nNous restons disponibles si vous souhaitez modifier ou préciser certains éléments.'
        : 'Nous revenons vers vous concernant votre projet. Nous restons disponibles pour poursuivre nos échanges.';
    return { subject: `A&B Technologies — Suivi de votre projet ${c.reference}`, body: `Bonjour ${c.first_name},\n\n${text}` };
  },
  complete(template) { return { subject: template.subject, body: template.body + this.signature }; }
};
