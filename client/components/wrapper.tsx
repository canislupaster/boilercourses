"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Course, CourseId, ServerInfo, ServerResponse } from "../../shared/types";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@nextui-org/modal";
import { NextUIProvider } from "@nextui-org/system";
import { Button, Loading } from "./util";
import { usePathname, useRouter } from "next/navigation";
import { twMerge } from "tailwind-merge";
import Script from "next/script";
import { createPortal } from "react-dom";

export type ModalCtxType = {
	extraActions: Element|null,
	closeModal: ()=>void,
	setLoading: (loading?: boolean)=>void
};

export type ModalAction = {
	name: React.ReactNode,
	act: (ctx: ModalCtxType)=>(void|boolean),
	icon?: React.ReactNode,
	status?: "primary"|"bad"
};

export type AppModal = {
	type: "error", name: string, msg: string, retry?: () => void
} | {
	type: "other", name?: string,
	actions?: ModalAction[],
	onClose?: () => void, modal?: React.ReactNode
};

export type Auth = {id: string, key: string};

export function setAuth(x: Auth|null) {
	if (x==null) window.localStorage.removeItem("auth");
	else window.localStorage.setItem("auth", JSON.stringify(x));
}

export function isAuthSet() {
	return window.localStorage.getItem("auth")!=null;
}

export type AuthErr = ServerResponse<unknown>&{status: "error", error: "unauthorized"|"sessionExpire"};

export function redirectToSignIn() {
	const router = useRouter();
	const app = useContext(AppCtx);
	return (err?: AuthErr) => {
		app.forward();
		window.localStorage.setItem("signIn", JSON.stringify({err, redirect: window.location.href}));
		router.push("/signin");
	};
}

export type AppCtx = {
	open: (m: AppModal) => void,
	tooltipCount: number, incTooltipCount: ()=>void,
	forward: ()=>void, back: ()=>void,
	info: ServerInfo
};

export const AppCtx = React.createContext<AppCtx>("context not initialized" as any)

const cache: Record<string, Promise<any>> = {};

export type APICallResult<T,R> = {res: R, endpoint: string, req: T|undefined};

export type APIOptions<T,R> = {
	data?: T, method?: string,
	//lmao
	//null = don't handle error / no retries/popup
	//undefined = handle error
	//both result in null response
	handleErr?: (e: ServerResponse<R>&{status:"error"}) => R|null|undefined,
	noCache?: boolean, cb?: (resp: APICallResult<T,R>|null)=>void,
	refresh?: (resp: APICallResult<T,R>)=>void
};

export function callAPI<R,T extends any=null>(endpoint: string, auth?: boolean|"maybe") {
	const c = useContext(AppCtx);
	const i = useRef(0);
	const redir = auth ? redirectToSignIn() : null;

	const run = async (body: string, k: string,
		{data, method, handleErr, noCache}: APIOptions<T,R>, rerun: ()=>void) => {

		let cacheBad = cache[k]==undefined || noCache || auth;
		while (!cacheBad) {
			try {
				const t = cache[k];
				const r=await t;
				if (t!=cache[k]) continue;
				if (r.status!="ok") cacheBad=true;
			} catch (e) {
				cacheBad=true;
			};

			break;
		}

		let headers: Record<string,string>={};
		if (auth) {
			const x = window.localStorage.getItem("auth");
			if (x!=null) {
				const v = JSON.parse(x) as Auth;
				headers["Authorization"] = `Basic ${v.id} ${v.key}`;
			} else if (auth===true) {
				c.open({type: "other", name: "You need to login to access this feature",
					actions: [
						{name: "Continue to sign in", status: "primary", act() {redir!!();}}
					]
				});

				return null;
			}
		}

		if (cacheBad) {
			cache[k] = fetch(`/api/${endpoint}`, {
				method: method ?? "POST",
				body: data==undefined ? undefined : body,
				headers
			}).then(x=>x.json());
		}

		const resp = await cache[k] as ServerResponse<R>;

		if (resp.status=="error") {
			const recover = handleErr?.(resp);
			if (recover!=undefined) return {
				res: recover, endpoint, req: data
			};

			if (auth && (resp.error=="unauthorized" || resp.error=="sessionExpire") && recover!==null) {
				redir!!({...resp, error: resp.error});
			} else if (recover!==null) {
				let name = "Unknown error";
				switch (resp.error) {
					case "badRequest": name = "Bad Request"; break;
					case "loading": name = "Loading"; break;
					case "notFound": name = "Not Found"; break;
					case "other": name = "Other Error"; break;
					case "rateLimited": name = "Rate Limited"; break;
					case "banned": name = "You've been banned!"; break;
					case "sessionExpire": name = "Session expired"; break;
					case "unauthorized": name = "Unauthorized"; break;
				}

				console.error(resp);
				c.open({type: "error", name, msg: resp.message ?? "Error performing API request.", retry: rerun })
			}

			return null;
		} else {
			return {res: resp.result, endpoint, req: data};
		}
	};

	const [v, setV] = useState<APICallResult<T,R>|null>(null);
	const [loading, setLoading] = useState(false);

	return {
		call(x: APIOptions<T,R> ={}) {
			const body = JSON.stringify(x.data); //hehe, cursed
			const k = `${x.method ?? "POST"} ${endpoint}\n${body}`;

			const attempt = () => {
				const oi = ++i.current;
				setLoading(true);

				run(body, k, x, attempt).then((res) => {
					if (i.current==oi) {
						x.cb?.(res);
						setLoading(false);

						if (res!=null) {
							setV(res);
							x.refresh?.(res);
						}
					}
				}).catch((e) => {
					console.error(`Fetching ${endpoint}: ${e}`);

					c.open({
						type: "error", name: "Error reaching API",
						msg: `Fetch error: ${e instanceof Error ? e.message : e}. Try refreshing?`, retry: attempt
					});
				});
			};

			return {attempt, k};
		},
		run(x: APIOptions<T,R> ={}) {
			this.call(x).attempt();
		},
		current: v,
		loading
	};
}

export function setAPI<R,T extends any=null>(endpoint: string, {data,method,result}: {
	data?: T, method?: string, result: R
}) {
	const r: ServerResponse<R> = { status: "ok", result };
	cache[`${method ?? "POST"} ${endpoint}\n${JSON.stringify(data)}`] = Promise.resolve(r);
}

export function useAPI<R,T extends any=null>(endpoint: string, {
	auth, debounceMs, ...x
}: APIOptions<T,R>&{auth?: boolean|"maybe", debounceMs?: number} = {}) {
	const {call,current} = callAPI<R,T>(endpoint, auth);
	const y = call(x);

	useEffect(()=>{
		if (debounceMs) {
			const tm = setTimeout(()=>y.attempt(), debounceMs);
			return () => clearTimeout(tm);
		} else {
			y.attempt();
		}
	}, [y.k]);

	return current;
}

export const useInfo = (): ServerInfo => useContext(AppCtx).info;
export const useCourse = (id: number): CourseId|null =>
	useAPI<CourseId,number>("course", {data:id})?.res ?? null;

export const ModalCtx = createContext<ModalCtxType>({
	extraActions: null,
	closeModal: ()=>{},
	setLoading: (loading?: boolean)=>{}
});

export function ModalActions({children}: {children?: React.ReactNode}) {
	const ctx = useContext(ModalCtx);
	return <>
		{children && ctx.extraActions && createPortal(children, ctx.extraActions)}
	</>;
}

function ModalContentInner({closeAll, close, x}: {x: AppModal&{type: "other"}, close: ()=>void, closeAll?: ()=>void}) {
	const [extra, setExtra] = useState<Element|null>(null);
	const [ld, setLd] = useState<boolean>(false);
	const extraRef = useRef<HTMLDivElement>(null);

	const ctx: ModalCtxType = {
		extraActions: extra,
		closeModal: close,
		setLoading: (x?: boolean)=>setLd(x===undefined || x===true)
	};

	useEffect(()=>setExtra(extraRef.current), []);

	return <>
		{x.name && <ModalHeader className="font-display font-extrabold text-2xl" >{x.name}</ModalHeader>}
		{x.modal && <ModalBody>
			<ModalCtx.Provider value={ctx} >
				{x.modal}
			</ModalCtx.Provider>
		</ModalBody>}
		<ModalFooter className="py-2" >
			{ld ? <Loading/> : <>
				<div ref={extraRef} className="contents" ></div>
				{x.actions && x.actions.map((x,i) =>
					<Button key={i} onClick={()=>{
						const ret = x.act(ctx);
						if (ret===undefined || ret===true) close();
					}} className={x.status==null ? "" : (x.status=="primary" ? "bg-blue-900" : "bg-red-800")}
						icon={x.icon} >
						{x.name}
					</Button>
				)}
				<Button onClick={close} >Close</Button>
				{closeAll && <Button onClick={closeAll} className="bg-red-800" >Close all</Button>}
			</>}
		</ModalFooter>
	</>;
}

export function GoatCounter({goatCounter}: {goatCounter: string}) {
	const path = usePathname();
	const initPath = useRef(path);
	useEffect(() => {
		if (initPath.current==path) return;

		const gt = (window as any).goatcounter;
		if (gt) gt.count({path});
	}, [path]);

	return <Script strategy="lazyOnload" src="/count.js" onLoad={() => {
		const wind = window as any;

		wind.goatcounter.no_onload = true;
		wind.goatcounter.allow_local = true;
		wind.goatcounter.endpoint = `https://${goatCounter}.goatcounter.com/count`;
		
		wind.goatcounter.count({path});
	}} />;
}

export function AppWrapper({children, className, info}: {children: React.ReactNode, className?: string, info: ServerInfo}) {
	//😒
	const [activeModals, setActiveModals] = useState<AppModal[]>([]);
	const [modalExtra, setModalVisible] = useState<Record<"error"|"other", boolean>>({
		error: false, other: false
	});
	const activeNormals = activeModals.filter(x=>x.type=="other");
	const activeErrors = activeModals.filter(x=>x.type=="error");
	const setVis = (x: "error"|"other", y: boolean) =>
		setModalVisible((vis) => ({...vis, [x]:y}));

	let m = <></>;
	if (activeNormals.length>0) {
		const x = activeNormals[activeNormals.length-1];
		m = <Modal isOpen={modalExtra["other"]} onClose={() => {
			x.onClose?.();
			if (activeNormals.length>1)
				setActiveModals(activeModals.filter(y=>y!=x));
			else setVis("other", false);
		}} backdrop="blur" placement="center" >
			<ModalContent>
				{(close) => <ModalContentInner close={close}
						closeAll={activeNormals.length>1 ? ()=>setVis("other", false) : undefined}
						x={x} />}
			</ModalContent>
		</Modal>;
	}
	
	if (activeErrors.length>0) {
		const x = activeErrors[activeErrors.length-1];
		const retry = x.retry!=undefined ? x.retry : null;

		m = <>{m}<Modal isOpen={modalExtra["error"]} onClose={() => {
			if (activeErrors.length>1) setActiveModals(activeModals.filter(y=>y!=x));
			else setVis("error", false);
		}} className="bg-red-900" backdrop="blur"
			placement="bottom-center" >
			<ModalContent>
				{(close) => (
					<>
						{x.name && <ModalHeader className="font-display font-extrabold text-2xl" >{x.name}</ModalHeader>}
						<ModalBody> <p>{x.msg}</p> </ModalBody>
						<ModalFooter className="py-2" >
							{retry ? <Button onClick={() => {close(); retry();}} >Retry</Button>
								: <Button onClick={close} >Close</Button>}
						</ModalFooter>
					</>
				)}
			</ModalContent>
		</Modal></>;
	}

	const [count, setCount] = useState(0);

	const [backUrls, setBackUrls] = useState<string[]>([]);
	const router = useRouter();

	const path = usePathname();
	useEffect(() => {
		// after using back button
		let i=backUrls.length-1;
		while (i>=0 && new URL(backUrls[i]).pathname==path) i--;
		if (i<backUrls.length-1) setBackUrls(backUrls.slice(0,i+1));

		setActiveModals([]);
	}, [path]);

  return (<NextUIProvider>
		<AppCtx.Provider value={{open: (m) => {
				if (!modalExtra[m.type]) {
					setActiveModals((active) => [...active.filter(x=>x.type!=m.type), m]);
					setVis(m.type, true);
				} else setActiveModals((active) => [...active, m]);
			}, tooltipCount: count,
				incTooltipCount: () => setCount(x=>x+1),
				forward() {
					setBackUrls([...backUrls, window.location.href]);
				}, back() {
					if (backUrls.length==0) router.push("/");
					else {
						const nb = backUrls.slice(0,-1);
						router.push(backUrls[backUrls.length-1]);
						setBackUrls(nb);
					}
				}, info
			}}>

			{m}
			<div id="parent" className={twMerge("flex flex-col bg-neutral-950 container mx-auto p-4 lg:px-14 lg:mt-5 max-w-screen-xl", className)}>
				{children}
			</div>
		</AppCtx.Provider>
  </NextUIProvider>);
}