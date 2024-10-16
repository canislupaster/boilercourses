"use client"

import { Alert, BackButton, searchState, TermSelect } from "@/components/clientutil";
import { PostCard, PostCardAdminUser, PostRefreshHook } from "@/components/community";
import { Button, ButtonPopover, containerDefault, Input, Loading, Text } from "@/components/util";
import { AppCtx, callAPI, isAuthSet, redirectToSignIn, useAPI } from "@/components/wrapper";
import { Checkbox } from "@nextui-org/checkbox";
import { Pagination } from "@nextui-org/pagination";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { AdminPost, UserData } from "../../../shared/posts";
import { latestTermofTerms, ServerInfo, Term } from "../../../shared/types";
import { LogoBar } from "@/components/logo";

type ListRequest = {
	reported: boolean, new: boolean, page: number
};

type ScrapeStatus = {
	status: "busy"|"ok"|"fail"|"notStarted",
	lastScrape: string|null
};

function AdminPosts() {
	const [req, setReq] = searchState<ListRequest>({reported: false, new: true, page: 0}, (parm) => {
		const pg = parm.get("page");
		return {reported: parm.get("reported")!=null, new: parm.get("new")!=null,
			page: pg==null ? 0 : Number.parseInt(pg)-1}
	}, (x) => {
		const parms: [string,string][] = [];
		if (x.reported) parms.push(["reported",""]);
		if (x.new) parms.push(["new",""]);
		if (x.page>0) parms.push(["page", (x.page+1).toString()]);
		return new URLSearchParams(parms);
	});

	const postsAPI = callAPI<{posts: AdminPost[], npage: number}, ListRequest>("posts/admin/list", "redirect");
	const refresh = () => postsAPI.run({ data: req });
	useEffect(()=>refresh(), [req]);

	const posts = postsAPI.current?.res;

	const reindex = callAPI("admin/reindex", "redirect");
	const scrape = callAPI<void, {term: Term|null, type: "unitime"|"catalog"}>("admin/scrape", "redirect");
	const logout = callAPI("logout", "redirect");
	const admins = callAPI<UserData[]>("admins", "redirect")

	//pretty bad way to chain requests
	//(only fetch once posts has succeeded)
	//i need an actual state management solution...
	useEffect(()=>{
		if (postsAPI.current!=null) admins.run()
	}, [postsAPI.current!=null]);

	const status = callAPI<ScrapeStatus>("admin/status", "redirect");
	useEffect(()=>{
		status.run();
	}, [scrape.current, reindex.current]);

	const [adminInp, setAdminInp] = useState("");
	const setAdmin = callAPI<void, {email: string, admin: boolean}>("setadmin", "redirect");
	
	const del = callAPI<void, number>("posts/delete", "redirect");
	const dismiss = callAPI<void, number[]>("posts/admin/dismissreports", "redirect");
	const markRead = callAPI<void, number[]>("posts/admin/markread", "redirect");

	const router = useRouter();

	const runSetAdmin = (x: boolean) =>
		setAdmin.run({data: {email: adminInp, admin: x}, refresh() { admins.run(); }});

	const terms = Object.keys(useContext(AppCtx).info.terms) as Term[];
	const [term, setTerm] = useState<Term|null>(latestTermofTerms(terms));

	if (posts==null) return <Loading/>;

	const stat = status?.current?.res;
	const lastScrape = stat?.lastScrape ? `Last scrape: ${new Date(stat.lastScrape).toLocaleString()}` : "";
	const busy = stat?.status=="busy" || reindex.loading || scrape.loading;

	return <div className="flex flex-col gap-3" ><PostRefreshHook.Provider value={refresh} >
		<BackButton noOffset >Admin Panel</BackButton>

		<div className="flex flex-row flex-wrap gap-2" >
			<Button disabled={busy} onClick={()=>reindex.run()} >
				Reindex
			</Button>
			<Button onClick={()=>logout.run({refresh() {
				router.push("/");
			}})} disabled={logout.loading} >
				Logout
			</Button>
		</div>

		{term && <div className="flex flex-col gap-1 my-2" >
			<Text v="lg" >Scrape term</Text>
			<TermSelect term={term} setTerm={setTerm} terms={terms} />
			<div className="flex flex-row flex-wrap gap-2" >
				<Button disabled={busy}
					onClick={()=>scrape.run({data: {term, type: "unitime"}})} >
					Scrape UniTime
				</Button>
				<Button disabled={busy}
					onClick={()=>scrape.run({data: {term, type: "catalog"}})} >
					Scrape catalog
				</Button>
			</div>
		</div>}

		{stat==null ? <Loading/> :
			stat.status=="busy" ? <Alert txt="Currently scraping" />
			: stat.status=="fail" ? <Alert bad title="Failed to scrape" txt={lastScrape} />
			: stat.status=="ok" && <Alert title="Scrape succeeded" txt={lastScrape} />}

		<div>
			<Text v="lg" className="mb-2" >Admins</Text>
			{admins.current==null ? <Loading/> : <div className="flex flex-col gap-2" >
				{admins.current.res.map(v => <div className={`p-3 ${containerDefault}`} >
					<PostCardAdminUser user={v} />
				</div>)}
			</div>}
			<div className="flex flex-row gap-2 justify-start items-center mt-3" >
				<Input value={adminInp} onChange={(e)=>setAdminInp(e.target.value)} className="flex-1" />
				<Button disabled={setAdmin.loading} onClick={()=>runSetAdmin(true)} >Promote</Button>
				<Button disabled={setAdmin.loading} onClick={()=>runSetAdmin(false)} >Demote</Button>
			</div>
		</div>

		<div className="w-full flex flex-row items-center justify-between gap-4 flex-wrap" >
			<Text v="lg" >Posts</Text>
			<ButtonPopover title="Filter" >
				<div className="flex flex-col items-start" >
					<Checkbox isSelected={req.reported} onChange={(v)=>setReq({...req, reported: v.target.checked})} >Reported</Checkbox>
					<Checkbox isSelected={req.new} onChange={(v)=>setReq({...req, new: v.target.checked})} >New</Checkbox>
				</div>
			</ButtonPopover>
		</div>
		<div className="flex flex-col gap-2" >
			{posts.posts.length==0 && <Alert title="No posts found" txt="Maybe clear your filters?" />}
			{posts.posts.map(x => <div key={x.id} >
				<PostCard post={{...x, name: null, voted: false}} yours
					adminPost={x} deletePost={()=>del.run({data: x.id, refresh})}
					dismissReports={()=>dismiss.run({data: [x.id], refresh})} />
			</div>)}
		</div>

		{posts.posts.length>0 && <Button onClick={()=>
				markRead.run({refresh, data: posts.posts.map(x=>x.id)})
			} disabled={markRead.loading} >
			Mark page as read
		</Button>}
		{posts.npage>0 && <div className="w-full flex flex-col items-center" >
			<Pagination total={posts.npage} initialPage={(postsAPI.current?.req?.page ?? 0)+1} onChange={
				(page) => setReq({...req, page})
			} />
		</div>}
	</PostRefreshHook.Provider></div>;
}

export default function Admin() {
	const [ld, setLd]=useState(true);
	const redir = redirectToSignIn();
	useEffect(()=>{
		if (isAuthSet()) setLd(false);
		else redir();
	}, [ld]);

	if (ld) return <Loading/>;
	return <div className="flex flex-col items-center" >
		<AdminPosts/>
	</div>;
}