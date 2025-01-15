import { Checkbox } from "@nextui-org/checkbox";
import { Icon, IconArrowsSort, IconEdit, IconFlag2, IconPhoto, IconStar, IconStarFilled, IconThumbUp, IconThumbUpFilled, IconTrash, IconUserCircle, IconX } from "@tabler/icons-react";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Markdown, { Components } from "react-markdown";
import remarkGfm from 'remark-gfm';
import { twMerge } from "tailwind-merge";
import { AddPost, AdminPost, EditPost, Post, PostData, UserData } from "../../shared/posts";
import { SmallCourse } from "../../shared/types";
import { CourseLink } from "./card";
import { Alert, AppTooltip, Dropdown } from "./clientutil";
import { Anchor, bgColor, Button, Chip, containerDefault, IconButton, Loading, Text, Textarea, textColor } from "./util";
import { AppCtx, useAPI, ModalAction, ModalActions, ModalCtx, useSignInRedirect } from "./wrapper";

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
export function Stars({rating, setStar, sz}: {rating?: number, setStar?: (x: number)=>void, sz: number}) {
	const [previewStar, setPreviewStar] = useState<null|number>(null);

	const star = (x: Icon, i: number) =>
		setStar ? <button key={i} className="m-0 p-0 bg-none border-none inline" onClick={(ev)=>{
			setStar(i+1); setPreviewStar(null);
			ev.preventDefault();
		}} onPointerEnter={() => setPreviewStar(i+1)} onPointerLeave={() => setPreviewStar(null)} >
			{React.createElement(x, {size: sz})}
		</button> : React.createElement(x, {key: i, size: sz, className: "inline"});

	return <div className="flex flex-col items-start whitespace-nowrap" >
		<div className={`relative ${textColor.gray}`} style={{lineHeight: 0}} >
			<div>
				{[...new Array<void>(5)].map((_,i)=>star(IconStar, i))}
			</div>
			<div className={`left-0 top-0 absolute overflow-x-hidden whitespace-nowrap ${textColor.star}`}
				style={{width: `${(previewStar ?? rating ?? 0)*20}%`, opacity: previewStar!=null ? "50%" : "100%"}} >
				{[...new Array<void>(5)].map((_,i)=>star(IconStarFilled, i))}
			</div>
		</div>
	</div>;
}

function SafeLink({href, icon, children}: {href?: string, icon?: React.ReactNode, children?: React.ReactNode}) {
	const app = useContext(AppCtx);

	return <Anchor onClick={() => {
		app.open({type: "other", name: "Follow link?", modal: <>
			<p>This link hasn{"'"}t been checked by BoilerCourses and <b>may be unsafe</b>.</p>
			<p>Continue to <Anchor target="_blank" href={href} >{href}</Anchor>?</p>
		</>});
	}} className="items-start" >{icon}{children}</Anchor>;
}

function SafeImageLink({alt, src}: {alt?: string, src?: string}) {
	return <p className="flex flex-row gap-2" >
		<SafeLink icon={<IconPhoto/>} href={src} >{alt}</SafeLink>
	</p>;
}

function Blockquote({children}: {children?: React.ReactNode}) {
	return <blockquote className="pl-4 border-l-3 border-l-zinc-200 dark:border-l-zinc-400 py-2 [&>p]:whitespace-pre-wrap" >{children}</blockquote>;
}

// eslint-disable-next-line react/display-name
const titleComponent = (ord: number) => ({children}: {children: React.ReactNode}) => {
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
	if (ts<60*60) {cnt=Math.floor(ts/60); units="minute";}
	else if (ts<60*60*24) {cnt=Math.floor(ts/(60*60)); units="hour";}
	else if (ts<60*60*24*7) {cnt=Math.floor(ts/(60*60*24)); units="day";}
	else {cnt=Math.floor(ts/(60*60*24*7)); units="week";}

	return `${cnt} ${units}${cnt==1 ? "" : "s"} ago`
}

export const PostRefreshHook = createContext<null | (()=>void)>(null);

const useRefreshPosts = () => {
	const ctx = useContext(PostRefreshHook);
	return () => ctx?.();
};

function PostCreator({postLimit, add: add2, setAdd: setAdd2}: {
	postLimit: number, add: AddPost, setAdd: (x: AddPost)=>void
}) {
	const make = useAPI<void, AddPost>("posts/submit", "redirect");
	const [triedSubmit, setTriedSubmit] = useState(false);

	// updates propagate back to modal creator, but updates from creator dont come back here bc again my modal system is broken
	// and im too poor to create a real modal component that portals to the right place...
	const [add, setAdd3] = useState(add2);
	const setAdd = (add: AddPost) => {
		setAdd2(add); setAdd3(add);
	};

	const empty = add.rating==null && (add.text==null || add.text.trim().length==0);

	const ctx = useContext(ModalCtx)!;

	const formRef = useRef<HTMLFormElement>(null);
	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const refresh = useRefreshPosts();

	return <form ref={formRef} onSubmit={(ev) => {
		ev.preventDefault();
		setTriedSubmit(true);

		if (!empty && ev.currentTarget.reportValidity()) {
			ctx.setLoading();
			make.run({
				data: {...add, text: add.text==null || add.text.trim().length==0 ? null : add.text},
				cb(r) {
					if (r) {refresh(); ctx.closeModal();}
					else ctx.setLoading(false);
				}
			});
		}
	}} className="flex flex-col gap-4" >
		<Checkbox onChange={(ev)=>setAdd({...add, rating: ev.target.checked ? (add.rating ?? 5) : null})} isSelected={add.rating!=null} >
			Rate this course
		</Checkbox>

		{add.rating!=null && <Stars sz={35} rating={add.rating} setStar={x=>setAdd({...add, rating: x})} />}

		<b>Write your post here. You can use a subset of markdown to format your content.</b>

		<Textarea ref={textAreaRef} className="mb-0"
			onChange={(txt)=>setAdd({...add, text: txt.currentTarget.value.trimStart()})}
			minLength={1} maxLength={postLimit} value={add.text ?? ""}
			placeholder={add.rating!=null ? "Optional content (markdown)" : "I thought the course..."} >
		</Textarea>

		<Text v="dim" >{add.text?.trim()?.length ?? 0}/{postLimit} characters used</Text>

		<Checkbox onChange={(ev)=>setAdd({...add, showName: !ev.target.checked})} isSelected={!add.showName} >
			Post anonymously
		</Checkbox>

		{!add.showName && <Text v="dim" >
			You will still be associated with this post internally, but nothing (name/email/etc) will be made public.
		</Text>}

		{triedSubmit && empty && <Alert bad title="Your post is empty" txt="First add a rating or some text!" />}

		<ModalActions>
			<Button disabled={make.loading} className={bgColor.sky} onClick={()=>formRef.current?.requestSubmit()} >Submit</Button>
		</ModalActions>
	</form>;
}

function useCreatePost(x: AddPost) {
	const del = useAPI<void, number>("posts/delete", "redirect");
	const app = useContext(AppCtx);

	const ctx = useContext(PostRefreshHook);
	const [add, setAdd] = useState<AddPost>(x);

	//when post is edited elsewhere, need to update post id
	//however i dont want to overwrite post in editor
	useEffect(()=>setAdd(a=>({...a, edit: x.edit})), [x.edit]);

	//this is so terrible!
	return (postLimit: number) => {
		const id = add.edit;

		const acts: ModalAction[] = [];
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
			name: id==null || add.text==null ? "Create post" : "Edit post",
			modal: <PostRefreshHook.Provider value={ctx} >
				<PostCreator postLimit={postLimit} add={add} setAdd={setAdd} />
			</PostRefreshHook.Provider>
		});
	};
}

const postToAddPost = (post: EditPost, course: number): AddPost => ({
	rating: post.rating, text: post.text, course,
	showName: post.name!=null, edit: post.id
});

function PostEditButton({post, course, postLimit}: {
	post: EditPost, course: number, postLimit: number
}) {
	const edit = useCreatePost(postToAddPost(post,course));
	return <IconButton icon={<IconEdit/>} onClick={()=>edit(postLimit)} />;
}

function BanModal({user}: {user: number}) {
	const ban = useAPI<void, {id: number, removePosts: boolean, banned: boolean}>("ban", "redirect");
	const [removePosts, setRemovePosts] = useState(false);
	const modal = useContext(ModalCtx)!;
	const refresh = useRefreshPosts();

	return <>
		<Checkbox isSelected={removePosts} onChange={ev=>setRemovePosts(ev.target.checked)} >
			Remove all posts
		</Checkbox>
		<ModalActions>
			<Button className={bgColor.red} disabled={ban.loading} onClick={()=>
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
	const {run, current, loading} = useAPI<UserData, number>("userdata", "redirect");
	const v = current?.res ?? user;
	useEffect(()=>run({data: user.id}), [run, user.id]);

	const ban = useAPI<void, {id: number, banned: boolean}>("ban", "redirect");
	const ctx = useContext(PostRefreshHook);

	return <div className="p-3 flex flex-col gap-2" >
		{[["User id:" ,v.id],
			["Name:", v.name],
			["Email:", v.email]]
			.map(([a,b]) => <div key={a} className="flex flex-row justify-between items-center gap-3" >
				<b>{a}</b> {b}
			</div>)}
		<p>
			{v.banned && <Chip color="red" >Banned</Chip>}
			{v.admin && <Chip color="green" >Admin</Chip>}
		</p>

		<Button disabled={ban.loading || loading} className={bgColor.red} onClick={()=>{
			if (!v.banned) app.open({
				type: "other",
				name: "Ban options",
				modal: <PostRefreshHook.Provider value={() => {
					run({data: user.id});
					ctx?.();
				}} ><BanModal user={v.id} /></PostRefreshHook.Provider>
			})
			else {
				ban.run({data: {id: v.id, banned: false}, refresh() {
					run({data: user.id});
					ctx?.();
				}});
			}
		}} >{!v.banned ? "Ban user" : "Unban user"}</Button>
	</div>;
}

export function PostCardAdminUser({user, className}: {user: UserData, className?: string}) {
	return <AppTooltip content={<AdminUserPopup user={user} />} >
		<Anchor className={className} >
			<Text>{user.name}</Text>
			<Text v="dim" >{user.email}</Text>
		</Anchor>
	</AppTooltip>;
}

export function PostCard({post, adminPost, editButton, deletePost, dismissReports, yours}: {
	post: Post, editButton?: React.ReactNode, adminPost?: AdminPost
	deletePost?: ()=>void, dismissReports?: ()=>void, yours?: boolean
}) {
	const vote = useAPI<void, {id: number, vote: boolean}>("posts/vote", "redirect");
	const report = useAPI<{alreadyReported: boolean}, number>("posts/report", "redirect");

	const [voted, setVoted] = useState(post.voted);
	const app = useContext(AppCtx);
	const ctx = useContext(PostRefreshHook);

	return <div className={`flex flex-col gap-3 p-5 ${containerDefault}`} >
		<div className="flex flex-row gap-3 items-center w-full justify-start flex-wrap" >
			{adminPost==null ? <Text v="bold" className="flex flex-row gap-1 items-center" >
				<IconUserCircle/>
				{yours ? "You" : post.name ?? "Anonymous"}
			</Text> : <div className="flex flex-col gap-2 items-start" >
				<div className="flex flex-row flex-wrap gap-2 items-center" >
					<CourseLink type="course" course={adminPost.course} className="text-xl" />
					{post.rating && <Stars sz={25} rating={post.rating} />}
				</div>
				<PostCardAdminUser className="font-bold text-xl" user={adminPost.userData} />
			</div>}

			{post.rating && adminPost==null && <Stars sz={20} rating={post.rating} />}
		</div>

		{adminPost!=null && adminPost.numReports>0 && <Alert title="Reported" txt={<>
			This post has been reported <b>{adminPost.numReports}</b> time{adminPost.numReports==1 ? "" : "s"}.
			{dismissReports && <Button onClick={dismissReports} className="mt-2" >
				Dismiss reports
			</Button>}
		</>} bad ></Alert>}

		{adminPost ? <pre className={`p-3 rounded-md max-h-52 overflow-y-auto whitespace-pre-wrap ${bgColor.secondary}`} >
			{post.text}
		</pre> : <Markdown remarkPlugins={[remarkGfm]} components={{
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
			<Text v="sm" >
				submitted <TimeSince t={post.submitted} />{adminPost && `, id: ${post.id}`}
			</Text>
			<div className="flex flex-row gap-1 items-center" >
				{deletePost && <IconButton icon={<IconTrash/>} onClick={deletePost} />}

				<IconButton icon={voted ? <IconThumbUpFilled/> : <IconThumbUp/>} onClick={()=>{
					if (!yours) {
						vote.run({data: {id: post.id, vote: !voted}, refresh(r) {
							setVoted(r.req!.vote);
						}});
					}
				}} />

				<span className="font-display font-bold mr-3" >
					{post.votes + (voted ? 1 : 0) - (post.voted ? 1 : 0)}
				</span>

				{editButton}

				{!adminPost && <IconButton icon={<IconFlag2/>} onClick={()=>{
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
					}} />}
			</div>
		</div>
	</div>
}

function CreatePostButton({postLimit, course, post}: {postLimit: number, course: number, post?: EditPost}) {
	const create = useCreatePost(post ? postToAddPost(post, course) : {text: "", rating: null, course, edit: null, showName: false});
	const make = useAPI<void, AddPost>("posts/submit", "redirect");
	const del = useAPI<void, number>("posts/delete", "redirect");
	const ctx = useContext(PostRefreshHook);

	const ratingPost = (x: number): AddPost => ({
		edit: post?.id ?? null, showName: false, rating: x, course: course, text: null
	});

	return <div className="flex flex-col gap-1 items-center" >
		<Button onClick={()=>create(postLimit)} >{post && post.text!=null ? "Edit your post" : "Got something to say?"}</Button>
		{(post==undefined || post.text==null) && <>
			<Text v="dim" >or {post ? "update your" : "leave a"} rating</Text>
			{make.loading || del.loading
				? <Text v="dim" >Updating...</Text>
				: <div className="flex flex-row gap-3 items-center" >
						<Stars rating={post==undefined ? undefined : post.rating!}
						setStar={(r) => {
							make.run({data: ratingPost(r), refresh() { ctx?.(); }});
						}} sz={35} />
						{post && <IconButton icon={<IconX size={18} />} onClick={()=>
							del.run({ data: post.id, refresh() { ctx?.(); } })
						} />}
					</div>}
		</>}

	</div>;
}

export function Community({course}: {course: SmallCourse}) {
	const [sortBy, setSortBy] = useState<PostSortBy>("mostHelpful");

	const {run, current: posts} = useAPI<PostData, CoursePostsReq>("posts/course", "maybe");
	const refresh = () => run({data: {course: course.id, sortBy}});

	const redir = useSignInRedirect();
	const app = useContext(AppCtx);

	useEffect(refresh, [sortBy, app.hasAuth, run, course.id]);

	return <div className={twMerge("flex items-stretch flex-col gap-2 p-5 pt-2", containerDefault, bgColor.secondary)} ><PostRefreshHook.Provider value={refresh} >
		<div className="flex flex-col items-center gap-3 md:flex-row justify-between" >
			<div className="flex flex-row gap-2 items-center flex-wrap" >
				<Text v="md" >Community</Text>

				{course.avgRating!=null && <>
					<Stars sz={24} rating={course.avgRating} /> <span className="font-display font-black text-xl" >{course.ratings}</span>
				</>}
			</div>
			<div className="flex flex-row gap-2" >
				<Dropdown trigger={<Button icon={<IconArrowsSort/>} >Sort by</Button>} parts={
					sortByNames.map(([a,b])=>
						({type: "act", name: a, act() { setSortBy(b) }, active: sortBy==b}))
				} />
			</div>
		</div>

		<div className="py-3 md:px-7">
			{posts==null ? <div>
				<Loading className="py-5" />
			</div> : <div className="flex flex-col gap-2 overflow-y-auto max-h-96 md:max-h-[40rem] mb-5" >
				{posts.res.edit?.text!=null && <PostCard
					post={{...posts.res.edit, text: posts.res.edit.text}}
					key={posts.res.edit.id} yours editButton={
						<PostEditButton postLimit={posts.res.postLimit} course={course.id} post={posts.res.edit} />
					} />}
				{posts.res.posts.map(post => <PostCard post={post} key={post.id} />)}
			</div>}

			<div className="flex flex-col items-center justify-center gap-2" >
				{posts?.res.posts.length==0 && <p>No reviews yet...</p>}
				{posts!=null && app.hasAuth ? (posts?.res.edit==null ? <>
					<CreatePostButton postLimit={posts.res.postLimit} course={course.id} />
				</> : <>
					<CreatePostButton postLimit={posts.res.postLimit} course={course.id} post={posts.res.edit} />
				</>) : <>
					<p><b>Have something to say?</b></p>
					<Button onClick={()=>redir()} >Login</Button>
				</>}
			</div>
		</div>
	</PostRefreshHook.Provider></div>;
}