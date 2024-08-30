import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppCtx, callAPI, isAuthSet, ModalAction, ModalActions, ModalCtx, ModalCtxType, setAuth, useAPI } from "./wrapper";
import { Anchor, Button, Chip, IconButton, Loading, Textarea } from "./util";
import { Icon, IconArrowsSort, IconDotsVertical, IconEdit, IconFlag2, IconFlag2Filled, IconPaperclip, IconPhoto, IconPhotoOff, IconStar, IconStarFilled, IconThumbUp, IconThumbUpFilled, IconTrash, IconUserCircle } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@nextui-org/popover";
import { redirectToSignIn } from "@/app/signin/signin";
import { AddPost, AdminPost, Post, PostData, UserData } from "../../shared/posts";
import { useRouter } from "next/navigation";
import { Alert, AppTooltip, Dropdown, DropdownPart } from "./clientutil";
import { Checkbox } from "@nextui-org/checkbox";
import React from "react";
import { SmallCourse } from "../../shared/types";
import { CourseLink } from "./card";
import Markdown, { Components } from "react-markdown";

type PostSortBy = "ratingAsc" | "ratingDesc" | "newest" | "mostHelpful";

const sortByNames: [string, PostSortBy][] = [
	["Most helpful", "mostHelpful"],
	["Newest", "newest"],
	["Highest rating", "ratingDesc"],
	["Lowest rating", "ratingAsc"]
];

type CoursePostsReq = {
	sortBy: PostSortBy,
	course: number
};

//rating: 1-5
export function Stars({rating, setStar, sz}: {rating: number, setStar?: (x: number)=>void, sz: number}) {
	const star = (x: Icon, i: number) =>
		setStar ? <button key={i} className="m-0 p-0 bg-none border-none inline" onClick={(ev)=>{
			setStar(i+1);
			ev.preventDefault();
		}}  >
			{React.createElement(x, {size: sz})}
		</button> : React.createElement(x, {key: i, size: sz, className: "inline"});

	return <div className="flex flex-col items-start whitespace-nowrap" ><div className="relative text-gray-200" style={{lineHeight: 0}} >
		{/* <div className="left-0 top-0 z-10 absolute whitespace-nowrap" >
			{[...new Array(5)].map((_,i)=>star(i))}
		</div> */}
		<div>
			{[...new Array(5)].map((_,i)=>star(IconStar, i))}
		</div>
		<div className="left-0 top-0 absolute text-amber-400 overflow-x-hidden whitespace-nowrap" style={{width: `${rating*20}%`}} >
			{[...new Array(5)].map((_,i)=>star(IconStarFilled, i))}
		</div>
	</div></div>;
}

function SafeLink({href, icon, children}: any) {
	const app = useContext(AppCtx);

	return <Anchor onClick={() => {
		app.open({type: "other", name: "Follow link?", modal: <>
			<p>This link hasn't been checked by BoilerCourses and <b>may be unsafe</b>.</p>
			<p>Continue to <Anchor target="_blank" href={href} >{href}</Anchor>?</p>
		</>});
	}} className="items-start" >{icon}{children}</Anchor>;
}

function SafeImageLink({alt, src}: any) {
	return <p className="flex flex-row gap-2" >
		<SafeLink icon={<IconPhoto/>} href={src} >{alt}</SafeLink>
	</p>;
}

function Blockquote({children}: any) {
	return <blockquote className="pl-4 border-l-3 border-l-zinc-400 py-2 [&>p]:whitespace-pre-wrap" >{children}</blockquote>;
}

const titleComponent = (ord: number) => ({children}: any) => {
	switch (ord) {
		case 1: return <h1 className="font-extrabold text-2xl" >{children}</h1>;
		case 2: return <h2 className="font-extrabold text-xl" >{children}</h2>;
		case 3: return <h3 className="font-bold text-lg" >{children}</h3>;
		default: return <h4 className="font-bold" >{children}</h4>;
	}
}

const titleComponents = Object.fromEntries([1,2,3,4,5,6].map(x => [`h${x}`, titleComponent(x)])) as Partial<Components>;

export function TimeSince({t}: {t: string}) {
	const ts = Math.floor((Date.now()-Date.parse(t))/1000);
	if (ts<60) return "just now";

	let cnt, units;
	if (ts<60*60) cnt=Math.floor(ts/60), units="minute";
	else if (ts<60*60*24) cnt=Math.floor(ts/(60*60)), units="hour";
	else if (ts<60*60*24*7) cnt=Math.floor(ts/(60*60*24)), units="day";
	else cnt=Math.floor(ts/(60*60*24*7)), units="week";

	return `${cnt} ${units}${cnt==1 ? "" : "s"} ago`
}

export const PostRefreshHook = createContext<null | (()=>void)>(null);
const refreshPosts = () => {
	const ctx = useContext(PostRefreshHook);
	return () => ctx?.();
};

function PostCreator({postLimit, add: add2, setAdd: setAdd2}: {
	postLimit: number, add: AddPost, setAdd: (x: AddPost)=>void
}) {
	const make = callAPI<{}, AddPost>("posts/submit", true);

	//needs to keep track of own state, otherwise passed thru modal which is illegal...
	const [add, setAdd] = useState(add2);
	useEffect(()=>setAdd2(add), [add]);
	const ctx = useContext(ModalCtx);

	const formRef = useRef<HTMLFormElement>(null);
	const refresh = refreshPosts();

	return <form ref={formRef} onSubmit={(ev) => {
		if (ev.currentTarget.reportValidity()) {
			ctx.setLoading();
			make.run({data: add, cb(r) {
				if (r) {refresh(); ctx.closeModal();}
				else ctx.setLoading(false);
			}});

			ev.preventDefault();
		}
	}} className="flex flex-col gap-4" >
		<Checkbox onChange={(ev)=>setAdd({...add, rating: ev.target.checked ? (add.rating ?? 5) : null})} isSelected={add.rating!=null} >
			Rate this course
		</Checkbox>

		{add.rating!=null && <Stars sz={35} rating={add.rating} setStar={x=>setAdd({...add, rating: x})} />}

		<b>Write your post here. You can use a subset of markdown to format your content.</b>

		<Textarea required className="mb-0"
			onChange={(txt)=>setAdd({...add, text: txt.currentTarget.value.trimStart()})}
			minLength={1} maxLength={postLimit} value={add.text} >
		</Textarea>

		<p className="text-xs text-gray-400" >{add.text.trim().length}/{postLimit} characters used</p>

		<Checkbox onChange={(ev)=>setAdd({...add, showName: !ev.target.checked})} isSelected={!add.showName} >
			Post anonymously
		</Checkbox>

		{!add.showName && <p className="text-xs text-gray-400" >
			You will still be associated with this post internally, but nothing (name/email/etc) will be made public.
		</p>}

		<ModalActions>
			<Button className="bg-blue-800" onClick={()=>formRef.current?.requestSubmit()} >Submit</Button>
		</ModalActions>
	</form>;
}

function createPost(x: AddPost) {
	const del = callAPI<{}, number>("posts/delete", true);
	const app = useContext(AppCtx);

	const ctx = useContext(PostRefreshHook);
	const [add, setAdd] = useState<AddPost>(x);

	//this is so terrible!
	return (postLimit: number) => {
		const id = add.edit;

		let acts: ModalAction[] = [];
		if (id!=null) {
			acts.push({name: "Delete", status: "bad", act(c) {
				if (del.loading) return;

				c.setLoading();
				del.run({data: id, cb(r) {
					if (r) {c.closeModal(); ctx?.();}
					else c.setLoading(false);
					return false;
				}});
			}})
		}

		app.open({type: "other", actions: acts,
			name: id==null ? "Create post" : "Edit post",
			modal: <PostRefreshHook.Provider value={ctx} >
				<PostCreator postLimit={postLimit} add={add} setAdd={setAdd} />
			</PostRefreshHook.Provider>
		});
	};
}

function PostEditButton({post, course, postLimit}: {
	post: Post, course: number, postLimit: number
}) {
	const edit = createPost({
		rating: post.rating, text: post.text, course,
		showName: post.name!=null, edit: post.id
	});

	return <IconButton icon={<IconEdit/>} onClick={()=>edit(postLimit)} />;
}

function BanModal({user}: {user: number}) {
	const ban = callAPI<{}, {id: number, removePosts: boolean, banned: boolean}>("ban", true);
	const [removePosts, setRemovePosts] = useState(false);
	const modal = useContext(ModalCtx);
	const refresh = refreshPosts();

	return <>
		<Checkbox isSelected={removePosts} onChange={ev=>setRemovePosts(ev.target.checked)} >
			Remove all posts
		</Checkbox>
		<ModalActions>
			<Button className="bg-red-600" onClick={()=>
				ban.run({refresh() {
					refresh();
					modal.closeModal();
				}, data: {
					id: user, removePosts, banned: true
				}})
			} >Ban user</Button>
		</ModalActions>
	</>;
}

function AdminUserPopup({user}: {user: UserData}) {
	const app = useContext(AppCtx);
	const data = callAPI<UserData, number>("userdata", true);
	const v = data.current?.res ?? user;
	useEffect(()=>data.run({data: user.id}), []);

	const ban = callAPI<{}, {id: number, banned: boolean}>("ban", true);
	const ctx = useContext(PostRefreshHook);

	return <div className="p-3 flex flex-col gap-2" >
		{[["User id:" ,v.id],
			["Name:", v.name],
			["Email:", v.email]]
			.map(([a,b]) => <div className="flex flex-row justify-between items-center gap-3" >
				<b>{a}</b> {b}
			</div>)}
		<p>
			{v.banned && <Chip color="red" >Banned</Chip>}
			{v.admin && <Chip color="green" >Admin</Chip>}
		</p>

		<Button disabled={ban.loading || data.loading} className="bg-red-600" onClick={()=>{
			if (!v.banned) app.open({
				type: "other",
				name: "Ban options",
				modal: <PostRefreshHook.Provider value={() => {
					data.run({data: user.id});
					ctx?.();
				}} ><BanModal user={v.id} /></PostRefreshHook.Provider>
			})
			else {
				ban.run({data: {id: v.id, banned: false}, refresh() {
					data.run({data: user.id});
					ctx?.();
				}});
			}
		}} >{!v.banned ? "Ban user" : "Unban user"}</Button>
	</div>;
}

export function PostCardAdminUser({user, className}: {user: UserData, className?: string}) {
	return <AppTooltip content={<AdminUserPopup user={user} />} >
		<Anchor className={className} >
			<span className="text-white" >{user.name}</span>
			<span className="text-sm text-gray-400" >{user.email}</span>
		</Anchor>
	</AppTooltip>;
}

export function PostCard({post, adminPost, editButton, deletePost, dismissReports}: {
	post: Post, editButton?: React.ReactNode, adminPost?: AdminPost
	deletePost?: ()=>void, dismissReports?: ()=>void
}) {
	const vote = callAPI<{}, {id: number, vote: boolean}>("posts/vote", true);
	const report = callAPI<{alreadyReported: boolean}, number>("posts/report", true);

	const [voted, setVoted] = useState(post.voted);
	const app = useContext(AppCtx);
	const ctx = useContext(PostRefreshHook);

	return <div className="border border-zinc-600 bg-zinc-700 flex flex-col gap-3 p-5 rounded-md" >
		<div className="flex flex-row gap-3 items-center" >
			{post.rating && adminPost==null && <Stars sz={20} rating={post.rating} />}

			{adminPost==null ? <h2 className="font-bold text-xl flex flex-row gap-2" >
				<IconUserCircle/>
				{post.isYours ? "You" : post.name ?? "Anonymous"}
			</h2> : <div className="flex flex-col gap-2 items-start" >
				<div className="flex flex-row flex-wrap gap-2 items-center" >
					<CourseLink type="course" course={adminPost.course} className="text-xl" />
					{post.rating && <Stars sz={20} rating={post.rating} />}
				</div>
				<PostCardAdminUser className="font-bold text-xl" user={adminPost.userData} />
			</div>}
		</div>

		{adminPost!=null && adminPost.numReports>0 && <Alert title="Reported" txt={<>
			This post has been reported <b>{adminPost.numReports}</b> time{adminPost.numReports==1 ? "" : "s"}.
			{dismissReports && <Button onClick={dismissReports} className="mt-2" >
				Dismiss reports
			</Button>}
		</>} bad ></Alert>}

		{adminPost ? <pre className="p-3 rounded-md max-h-52 overflow-y-scroll bg-zinc-800 whitespace-pre-wrap" >
			{post.text}
		</pre> : <Markdown components={{
			a: SafeLink, img: SafeImageLink,
			blockquote: Blockquote,
			...titleComponents
		}} allowedElements={[
			"h1", "h2", "h3", "h4", "h5", "h6",
			"p", "a", "img", "ul", "ol", "li",
			"strong", "em", "blockquote", "br"
		]} >
			{post.text}
		</Markdown>}

		<div className="flex flex-row justify-between w-full items-center flex-wrap gap-2" >
			<p className="text-sm text-gray-400" >
				submitted <TimeSince t={post.submitted} />{adminPost && `, id: ${post.id}`}
			</p>
			<div className="flex flex-row gap-1 items-center" >
				{deletePost && <IconButton icon={<IconTrash/>} onClick={deletePost} />}

				<IconButton icon={voted ? <IconThumbUpFilled/> : <IconThumbUp/>} onClick={()=>{
					if (!post.isYours) {
						vote.run({data: {id: post.id, vote: !voted}, refresh(r) {
							setVoted(r.req!!.vote);
						}});
					}
				}} />

				<span className="font-display font-bold mr-3" >
					{post.votes + (voted ? 1 : 0) - (post.voted ? 1 : 0)}
				</span>

				{editButton}

				<IconButton icon={<IconFlag2/>} onClick={()=>{
					app.open({type: "other", name: "Report post?", modal: "Please report inappropriate posts.",
						actions: [
							{
								name: "Report", status: "bad",
								act(c) {
									report.run({data: post.id, cb(r) {
										if (r) {
											c.closeModal();
											if (r.res.alreadyReported)
												app.open({type: "error", name: "You've reported this post already", msg: "The offending post will be reviewed soon."});
											else {
												app.open({type: "other", name: "Post reported", modal: "Thanks for your help."});
												ctx?.();
											}
										}
									}});
									return false;
								}
							}
						]});
					}} />
			</div>
		</div>
	</div>
}

function CreatePostButton({postLimit, course}: {postLimit: number, course: number}) {
	const create = createPost({text: "", rating: null, course, edit: null, showName: false});
	return <Button onClick={()=>create(postLimit)} >Create post</Button>;
}

export function Community({course}: {course: SmallCourse}) {
	const [sortBy, setSortBy] = useState<PostSortBy>("mostHelpful");

	const postsReq = callAPI<PostData, CoursePostsReq>("posts/course", "maybe");
	const posts = postsReq.current;
	const refresh = () => {
		postsReq.run({data: {course: course.id, sortBy}})
	};

	useEffect(refresh, [sortBy]);

	const isLoggedIn = posts?.res?.loggedIn!=null;
	const logout = callAPI("logout", true);
	const deleteUser = callAPI("deleteuser", true);

	const redir = redirectToSignIn();
	const app = useContext(AppCtx);

	const drop: DropdownPart[] = [
		{type: "txt", txt: <p>{posts?.res?.loggedIn ?
			<>Logged in with <b>{posts.res.loggedIn.email}</b></>
			: <>Not logged in</>
		}</p>},
		{type: "act", name: isLoggedIn ? "Logout" : "Sign in",
			disabled: isLoggedIn==null || postsReq.loading || logout.loading, act() {
			if (isLoggedIn) {
				logout.run();
				setAuth(null);
				refresh();
			} else redir();
		}},
	];

	if (isLoggedIn) drop.push({
		type: "act",
		name: <span className="text-red-400" >Delete all data</span>,
		act() {
			app.open({
				type: "other", name: "Delete all your data?",
				modal: <p>
					This will remove all <b>posts/reviews and any other information across all courses</b> associated with your account and Purdue email.
				</p>,
				actions: [
					{
						name: "Delete everything", status: "bad",
						act(c) {
							c.setLoading();
							deleteUser.run({refresh() { c.closeModal(); refresh(); }});
							return false;
						}
					}
				]
			});
		}
	});

	return <div className="flex items-stretch flex-col gap-2 border-zinc-600 bg-zinc-800 border-1 p-5 rounded-lg" ><PostRefreshHook.Provider value={refresh} >
		<div className="flex flex-col items-center gap-3 md:flex-row justify-between" >
			<div className="flex flex-row gap-2 items-center flex-wrap" >
				<h2 className="font-extrabold font-display text-2xl" >Community</h2>

				{course.avgRating!=null && <>
					<Stars sz={24} rating={course.avgRating} /> <span className="font-display font-black text-xl" >{course.ratings}</span>
				</>}
			</div>
			<div className="flex flex-row gap-2" >
				<Dropdown trigger={<IconButton icon={<IconUserCircle/>} />} parts={drop} />
				<Dropdown trigger={<Button icon={<IconArrowsSort/>} >Sort by</Button>} parts={
					sortByNames.map(([a,b])=>
						({type: "act", name: a, act() { setSortBy(b) }, active: sortBy==b}))
				} />
			</div>
		</div>

		<div className="py-3 md:px-7">
			{posts==null ? <Loading/> : <div className="flex flex-col gap-2 overflow-y-scroll max-h-96 md:max-h-[40rem] mb-5" >
				{posts.res.posts.map(post =>
					<PostCard post={post} key={post.id} editButton={
						post.isYours ? <PostEditButton postLimit={posts.res.postLimit} course={course.id} post={post} /> : undefined
					} />
				)}
			</div>}

			<div className="flex flex-col items-center justify-center gap-2" >
				{posts?.res?.canMakePost ? <>
					{posts?.res?.posts?.length==0 && <p>Nobody has contributed to this course yet!</p>}
					<CreatePostButton postLimit={posts.res.postLimit} course={course.id} />
				</> : !isLoggedIn && <>
					{posts?.res?.posts?.length==0 && <p>Nobody has contributed to this course.</p>}
					<p><b>Want to add a post?</b></p>
					<Button onClick={()=>redir()} >Login</Button>
				</>}
			</div>
		</div>
	</PostRefreshHook.Provider></div>;
}