// Fixed examples for the explicitly selected sample mode. No API or input interpolation.
const thankYou = {
  name: 'Thank-You Letter',
  text: `Dear Alex,

Thank you for helping me prepare my project presentation. Your thoughtful feedback helped me explain my ideas more clearly, and your encouragement made a real difference.

I especially appreciated the time you took to walk through the slides with me. You helped me see where the story needed more focus and gave me the confidence to present the final work.

I am grateful for your patience, generosity, and support.

With warm thanks,
Sam`,
};
const resignation = {
  name: 'Resignation Letter',
  text: `Dear [Manager's Name],

Please accept this letter as formal notice of my resignation from my position as [Job Title] at [Company Name]. My last working day will be [Date].

Thank you for the opportunities to learn and grow during my time with the team. I have appreciated your support and the chance to work alongside my colleagues.

During my remaining time, I will do my best to document my current work and support a smooth handover.

Thank you again for the experience and your understanding.

Sincerely,
[Your Name]`,
};
const general = {
  name: 'General Letter',
  text: `Dear Alex,

I am writing to invite you to a small gathering at [Location] on [Date] at [Time]. It would be lovely to spend some time together and catch up.

Please let me know whether you will be able to join us, and feel free to share any questions about the plans.

I hope to see you there.

Warm regards,
Sam`,
};
export function sampleLetter(roleId) {return {...(roleId==='general'?general:roleId==='resignation'?resignation:thankYou)};}

// Paced chunks exercise the same append/finish path as the real model stream.
export async function* streamSampleLetter(roleId) {
  const chars=Array.from(sampleLetter(roleId).text);
  for(let i=0;i<chars.length;i+=5){await new Promise(resolve=>setTimeout(resolve,80));yield chars.slice(i,i+5).join('');}
}
