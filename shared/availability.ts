import { Section, SmallCourse, Term } from "./types";

export type RegisterNotificationRequest = {
	course: number, crn: number|null, threshold: number, term: Term
};

export type Notification = {
	id: number,
	section: Section|null, course: SmallCourse, term: Term,
	threshold: number, satisfied: boolean, sent: boolean
};