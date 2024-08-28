"use client"

import { Alert, msalClientId, searchState } from "@/components/clientutil";
import { Button, ButtonPopover, Input, Loading } from "@/components/util";
import { AppCtx, AppWrapper, callAPI, isAuthSet, setAuth, useAPI } from "@/components/wrapper";
import { useContext, useEffect, useMemo, useState } from "react";
import { ServerInfo } from "../../../shared/types";
import { AdminPost, UserData } from "../../../shared/posts"
import { redirectToSignIn } from "../signin/signin";
import { Checkbox } from "@nextui-org/checkbox";
import { PostCard, PostCardAdminUser, PostRefreshHook } from "@/components/community";
import { Pagination } from "@nextui-org/pagination";

type ListRequest = {
	reported: boolean, new: boolean, page: number
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

	const postsAPI = callAPI<{posts: AdminPost[], npage: number}, ListRequest>("posts/admin/list", true);
	const refresh = () => postsAPI.run({ data: req });
	useEffect(()=>refresh(), [req]);

	const posts = postsAPI.current?.res;

	const reindex = callAPI("reindex", true);
	const admins = callAPI<UserData[]>("admins", true)

	//pretty bad way to chain requests
	//(only fetch once posts has succeeded)
	//i need an actual state management solution...
	useEffect(()=>{
		if (postsAPI.current!=null) admins.run()
	}, [postsAPI.current!=null]);

	const [adminInp, setAdminInp] = useState("");
	const setAdmin = callAPI<{}, {email: string, admin: boolean}>("setadmin", true);
	
	const del = callAPI<{}, number>("posts/delete", true);
	const dismiss = callAPI<{}, number[]>("posts/admin/dismissreports", true);
	const markRead = callAPI<{}, number[]>("posts/admin/markread", true);

	const runSetAdmin = (x: boolean) =>
		setAdmin.run({data: {email: adminInp, admin: x}, refresh() { admins.run(); }});

	if (posts==null) return <Loading/>;

	return <div className="max-w-screen-md flex flex-col gap-3" ><PostRefreshHook.Provider value={refresh} >
		<Button disabled={reindex.loading} onClick={()=>reindex.run()} >
			Reindex{reindex.loading && "ing..."}
		</Button>

		<div>
			<h2 className="font-display text-2xl font-bold mb-2" >Admins</h2>
			{admins.current==null ? <Loading/> : <div className="flex flex-col gap-2" >
				{admins.current.res.map(v => <div className="p-3 rounded-md bg-gray-600" >
					<PostCardAdminUser user={v} />
				</div>)}
			</div>}
			<div className="flex flex-row gap-2 justify-evenly items-center mt-3" >
				<Input value={adminInp} onChange={(e)=>setAdminInp(e.target.value)} />
				<Button disabled={setAdmin.loading} onClick={()=>runSetAdmin(true)} >Promote</Button>
				<Button disabled={setAdmin.loading} onClick={()=>runSetAdmin(false)} >Demote</Button>
			</div>
		</div>

		<div className="w-full flex flex-row items-center justify-between" >
			<h3 className="font-bold font-display text-2xl" >Posts</h3>
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
				<PostCard post={{...x, name: null, isYours: true, voted: false}}
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

export function Admin() {
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