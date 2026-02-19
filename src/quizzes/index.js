import week1 from "./week-1-key-sovereignty";
import week2 from "./week-2-x9-extended-key-usage";
import week3 from "./week-3-protocols";
import week4 from "./week-4-acme";
import week5 from "./week-5-trustcore";
import week6 from "./week-6-dns";
import week7 from "./week-7-tlm-part-1";
import week8 from "./week-8-cert-central-part-1";
import week9 from "./week-9-dns-part-2";
import week10 from "./week-10-software-trust";
import week11 from "./week-11-tlm-part-2";
import week12 from "./week-12-compliance-dates";
import week13 from "./week-13-root-strategy";
import week14 from "./week-14-pam";
import week15 from "./week-15-tlm-part-3";
import week16 from "./week-16-cert-central-part-2";

export const quizzes = {
  [week1.id]: week1,
  [week2.id]: week2,
  [week3.id]: week3,
  [week4.id]: week4,
  [week5.id]: week5,
  [week6.id]: week6,
  [week7.id]: week7,
  [week8.id]: week8,
  [week9.id]: week9,
  [week10.id]: week10,
  [week11.id]: week11, 
  [week12.id]: week12, 
  [week13.id]: week13, 
  [week14.id]: week14,
  [week15.id]: week15,
  [week16.id]: week16,
};

export const currentQuizId = week16.id;

export function getQuiz(id) {
  return quizzes[id];
}
