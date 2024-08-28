import { SmallCourse } from "./types";

export type AdminPost = {
	id: number,
	userData: UserData,
	course: SmallCourse,
	rating: number|null,
	text: string,
	numReports: number,
	submitted: string,
	votes: number
};

export type Post = {
	name: string|null,
	rating: number|null,
	votes: number,
	text: string,
	id: number,
	isYours: boolean,
	voted: boolean,
	submitted: string
};

export type UserData = {
	id: number,
	email: string,
	name: string,
	banned: boolean,
	admin: boolean
};

export type PostData = {
	posts: Post[],
	postLimit: number,
	loggedIn: UserData|null,
	canMakePost: boolean
};

//data class AddCoursePost(val showName: Boolean, val edit: Int?, val course: Int, val rating: Int?, val text: String)
export type AddPost = {
	showName: boolean,
	edit: number|null,
	course: number,
	rating: number|null,
	text: string
};