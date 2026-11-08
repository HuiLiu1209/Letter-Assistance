// Fixed examples for the explicitly selected sample mode. No API or input interpolation.
const thankYou = {
  name: 'Thank-You Letter',
  text: `Dear Alex,

Thank you for reviewing my project presentation. Your feedback helped me clarify the main points and present my ideas with greater confidence.

With thanks,
Sam`,
};
const resignation = {
  name: 'Resignation Letter',
  text: `Dear Alex,

I am resigning from my position as Design Intern at Example Studio.

Thank you for the opportunity to work with the team.

Sincerely,
Sam`,
};
const general = {
  name: 'General Letter',
  text: `Dear Alex,

I would like to invite you to a small gathering. It would be lovely to catch up and spend some time together.

Warm regards,
Sam`,
};
export function sampleLetter(roleId) {return {...(roleId==='general'?general:roleId==='resignation'?resignation:thankYou)};}

// Paced chunks exercise the same append/finish path as the real model stream.
export async function* streamSampleLetter(roleId) {
  const chars=Array.from(sampleLetter(roleId).text);
  for(let i=0;i<chars.length;i+=5){await new Promise(resolve=>setTimeout(resolve,80));yield chars.slice(i,i+5).join('');}
}
