"use client"

import React, { useEffect, useState, PointerEvent, HTMLAttributes, useContext, useRef } from "react";
import { Course, CourseInstructor, formatTerm, latestTermofTerms, Section, ServerInfo, SmallCourse, Term, termIdx } from "../../shared/types";
import { Tooltip, TooltipPlacement } from "@nextui-org/tooltip";
import { twMerge } from "tailwind-merge";
import { AppCtx, useInfo } from "./wrapper";
import Link, { LinkProps } from "next/link";
import { Anchor, Button, gpaColor, Input, selectProps } from "./util";
import { IconArrowLeft, IconChevronDown, IconChevronUp, IconFilterFilled, IconInfoCircle, IconInfoTriangleFilled } from "@tabler/icons-react";
import { Progress } from "@nextui-org/progress";
import { TabsProps } from "@nextui-org/tabs";
import { default as Select, SingleValue } from "react-select";
import { PublicClientApplication } from "@azure/msal-browser";
import { Popover, PopoverContent, PopoverTrigger } from "@nextui-org/popover";
import { Collapse } from "react-collapse";

export type SelectionContext = {
	section: Section|null,
	selSection: (section: Section|null) => void,
	selTerm: (term: Term) => void
};

export const SelectionContext = React.createContext<SelectionContext>({
	section: null, selSection(){}, selTerm() {}
});

export function useMediaQuery(q: MediaQueryList|string, init: boolean=true) {
	const [x, set] = useState(init);

	useEffect(() => {
		const mq = typeof q=="string" ? window.matchMedia(q) : q;
		const cb = () => set(mq.matches);
		mq.addEventListener("change", cb);
		set(mq.matches);
		return ()=>mq.removeEventListener("change",cb);
	}, [q]);

	return x;
}

let mdMq=null;
try { mdMq = window.matchMedia("(min-width: 768px)"); } catch (e) {}
export const useMd = () => {
	if (mdMq==null) return false;
	return useMediaQuery(mdMq);
};

export function useDebounce<T>(f: ()=>T, debounceMs: number, deps: React.DependencyList): T {
	const [v, setV] = useState(f);
	useEffect(()=>{
		const ts = setTimeout(()=>setV(f()), debounceMs);
		return () => clearTimeout(ts);
	}, deps);
	return v;
}

export const IsInTooltipContext = React.createContext(false);

//opens in modal if already in tooltip...
export function AppTooltip({content, children, placement, className, onChange, ...props}: {content: React.ReactNode, placement?: TooltipPlacement, onChange?: (x: boolean)=>void}&Omit<HTMLAttributes<HTMLDivElement>,"content">) {
	const app = useContext(AppCtx);
	const [open, setOpen] = useState(false);
	const [reallyOpen, setReallyOpen] = useState<number|null>(null);
	
	const ctx = useContext(IsInTooltipContext);
	const unInteract = (p: PointerEvent<HTMLDivElement>) => {
		if (!ctx && p.pointerType=="mouse") setOpen(false);
	};

	const interact = (p: PointerEvent<HTMLDivElement>) => {
		if (!ctx && p.pointerType=="mouse") setOpen(true);
	};

	const selCtx = useContext(SelectionContext);

	useEffect(()=>{
		if (open) {
			if (reallyOpen==app.tooltipCount) return;

			app.incTooltipCount();

			if (ctx) {
				app.open({type: "other", modal: <SelectionContext.Provider value={selCtx} >
						{content}
					</SelectionContext.Provider>, onClose() {
					setOpen(false);
					setReallyOpen(null);
				}});
			} else {
				const tm = setTimeout(() => {
					setReallyOpen(app.tooltipCount+1);
				}, 200);

				const cb = ()=>setOpen(false);
				document.addEventListener("click",cb);

				return ()=>{
					document.removeEventListener("click",cb);
					clearTimeout(tm);
				};
			}
		} else if (!ctx) {
			const tm = setTimeout(() => setReallyOpen(null), 500);
			return ()=>clearTimeout(tm);
		}
	}, [open]);

	useEffect(()=> {
		onChange?.(reallyOpen==app.tooltipCount);
	}, [reallyOpen==app.tooltipCount])
	
	return <Tooltip showArrow placement={placement} content={
			<IsInTooltipContext.Provider value={true} >{content}</IsInTooltipContext.Provider>
		}
		classNames={{content: "max-w-96"}}
		isOpen={reallyOpen==app.tooltipCount}
		onPointerEnter={interact} onPointerLeave={unInteract} >

		<div className={twMerge("inline-block", className)}
			onPointerEnter={interact} onPointerLeave={unInteract}
			onClick={(ev)=>{
				setOpen(reallyOpen!=app.tooltipCount);
				ev.stopPropagation();
			}} {...props} >

			{children}
		</div>
	</Tooltip>;
}

export function AppLink(props: LinkProps&HTMLAttributes<HTMLAnchorElement>) {
	const app = useContext(AppCtx);
	return <Link {...props} onClick={(ev) => {
		app.forward();
		props.onClick?.(ev);
	}} >
		{props.children}
	</Link>
}

export const BackButton = ({children, noOffset}: {children?: React.ReactNode, noOffset?: boolean}) =>
	<div className='flex flex-row gap-3 align-middle'>
		<Anchor className={`lg:mt-1 mr-1 h-fit hover:-translate-x-0.5 transition ${
			noOffset ? "" : "lg:absolute lg:-left-10"}`}
			onClick={useContext(AppCtx).back} >
			<IconArrowLeft className="self-center" size={30} />
		</Anchor>

		{children && <div className="md:text-3xl text-2xl font-bold mb-6 font-display flex flex-col items-start">
			{children}
		</div>}
	</div>;

export function searchState<T>(start: T, init: (params: URLSearchParams) => T|undefined|null, change: (x:T)=>URLSearchParams|undefined|null): [T, (newX: T)=>void] {
	const [x,setX] = useState<T>(start);
	useEffect(()=>{
		const u = new URLSearchParams(window.location.search);
		if (u.size>0) {
			const t = init(u);
			if (t!=undefined) {
				window.history.replaceState(null,"",`?${change(t)?.toString()??""}`);
				setX(t);
			}
		}
	}, []);

	return [x, (newX: T) => {
		const p = change(newX);
		window.history.replaceState(null,"",`?${p?.toString()??""}`);
		setX(newX);
	}];
}

export function StyleClasses({f,classStyles}: {f: (setRef: React.Ref<HTMLElement|null>)=>React.ReactNode, classStyles: Record<string, Partial<CSSStyleDeclaration>>}) {
	const ref = useRef<HTMLElement|null>(null);
	useEffect(()=>{
		const e = ref.current!;
		for (const [cls, styles] of Object.entries(classStyles)) {
			const st = (e.getElementsByClassName(cls)[0] as HTMLElement).style;
			for (const k in styles)
				if (styles[k]!==undefined) st[k]=styles[k];
		}
	}, []);
	return f(ref);
}

export function BarsStat<T>({lhs,type,vs,className}: {lhs: (x: T)=>React.ReactNode, type: "gpa"|"rmp", vs: [T,number|null][], className?: string}) {
	if (vs.length==0) return <h2 className="text-xl font-bold w-full" >
		No data available
	</h2>;

	const y=vs.toSorted((a,b)=>(b[1]??-1) - (a[1]??-1)).map(([i,x], j)=>{
		if (x==null) {
			return <React.Fragment key={j} >
				{lhs(i)}
				<div className="col-span-2 flex-row flex items-center" >
					<span className="h-0.5 border-b border-dotted flex-grow mx-2" />
					<p className="col-span-2 my-auto ml-auto" >
						No {type=="rmp" ? "rating" : "grades"} available
					</p>
				</div>
			</React.Fragment>;
		}

		const c = gpaColor(type=="gpa" ? x : x-1);

		return <React.Fragment key={-j} >
			{lhs(i)}

			<div className="flex flex-row items-center" >
				<StyleClasses f={(ref)=>
					<Progress value={x} minValue={type=="gpa" ? 0 : 1} maxValue={type=="gpa" ? 4 : 5} classNames={{
						indicator: "indicator"
					}} ref={ref} />}
					classStyles={{indicator: {backgroundColor: c}}}
				/>
			</div>

			<span className="px-2 py-1 rounded-lg my-auto font-black font-display text-xl text-center" style={{backgroundColor: c}} >
				{x.toFixed(1)}
			</span>
		</React.Fragment>;
	});

	return <div className={twMerge("grid gap-2 grid-cols-[2fr_10fr_1fr] items-center", className)} >
		{y}
	</div>;
}

export function NameSemGPA<T>({vs,lhs}: {vs: [T, [Term, number|null, number|null][]][], lhs: (x: T)=>React.ReactNode}) {
	const selCtx = useContext(SelectionContext);
	
	const sems = [...new Set(vs.flatMap(x => x[1]).map(x=>x[0]))]
		.sort((a,b) => termIdx(a)-termIdx(b)).slice(-5);

	if (sems.length==0)
		return <p className='text-xl font-bold'>No data available</p>;

	const sorted = vs.map((x):[T, [Term, number|null, number|null][], number]=> {
		const bySem = new Map(x[1].map(v=>[v[0],v]));
		return [
			x[0],
			sems.map(s=>{
				const y = bySem.get(s);
				return [s,y?.[1] ?? null,y?.[2] ?? null];
			}),
			x[1].reduce((a,b)=>a+(b[1]!=null ? 1 : 0), 0)
		];
	}).sort((a,b)=>b[2]-a[2]);
	
	return <div>
		{sorted.map(([i, x], j) => (
			<div key={j} className='flex flex-col mt-5'>
				{lhs(i)}
				<div className='grid grid-flow-col auto-cols-fr justify-stretch'>
					{x.map(([sem, gpa, sections]) => (
						<div key={sem} className='flex flex-col mt-2'>
							<div className="flex flex-col h-12 items-center justify-center py-5"
								style={{backgroundColor: gpaColor(gpa)}} >

								<p className='text-white text-xl font-display font-black'>{gpa?.toFixed(1) ?? "?"}</p>
								{sections!=null && <p className='text-zinc-200 text-xs'>
									{sections} section{sections==1?"":"s"}
								</p>}
							</div>
							<Anchor onClick={() => selCtx.selTerm(sem)}
								className='text-zinc-400 text-sm justify-center text-center'>{formatTerm(sem)}</Anchor>
						</div>
					))}
				</div>
			</div>
		))}
	</div>;
}

export function WrapStat({search, setSearch, title, children, searchName}: {search: string, setSearch: (x:string)=>void, title: string, children: React.ReactNode, searchName: string}) {
	return <>
		<h2 className="text-2xl font-display font-extrabold mb-5" >{title}</h2>
		<Input icon={<IconFilterFilled/>} placeholder={`Filter ${searchName}...`}
			value={search} onChange={v => setSearch(v.target.value)} />
		<Collapse isOpened >
			<div className="max-h-[34rem] overflow-y-scroll mt-3" >
				{children}
			</div>
		</Collapse>
	</>;
}

export const tabProps: TabsProps = {
	"aria-label": "Display",
	size: "lg", variant:"light", classNames: {
		tab: "px-4 py-1.5 border text-white rounded-lg border-zinc-700 hover:border-zinc-600 data-[selected=true]:border-blue-500 outline-none bg-zinc-800",
		cursor: "bg-zinc-700 rounded-lg",
		tabContent: "text-gray-300 hover:text-gray-50 group-data-[selected=true]:text-gray-50"
	}
};

export const TermSelect = ({term, terms, setTerm, name}: {term: Term, terms: Term[], setTerm: (t:Term)=>void, name: string}) =>
	<div className="flex flex-wrap flex-row items-center gap-3 text-sm" >
		{name} from <Select
			options={terms.map((x):[number,Term]=>[termIdx(x as Term),x as Term])
				.sort((a,b)=>b[0]-a[0])
				.map(([_,x]) => ({label: formatTerm(x), value: x}))}
			value={{label: formatTerm(term), value: term}}
			onChange={(x: SingleValue<{label: string, value: Term}>) => setTerm(x!.value)}
			{...selectProps}
		/>
		<span className="text-gray-400" >
			last updated {new Date(useInfo().terms[term]!.lastUpdated).toLocaleDateString()}
		</span>
	</div>;

// used for client side filtering (e.g. instructors in prof tabs)
export const simp = (x: string) => x.toLowerCase().replace(/[^a-z0-9\n]/g, "");

export const msalClientId = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID;
export const msalApplication = new PublicClientApplication({
	auth: {
		clientId: msalClientId!,
		authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MSAL_TENANT!}`
	 }
});

export const Alert = ({title, txt, bad, className}: {title?: React.ReactNode, txt: React.ReactNode, bad?: boolean, className?: string}) =>
	<div className={twMerge(`border ${bad ? "border-red-500 bg-red-900" : "border-zinc-700 bg-zinc-900"} p-2 px-4 rounded-md flex flex-row gap-2`, className)} >
		<div className="flex-shrink-0 mt-1" >
			{bad ? <IconInfoTriangleFilled/> : <IconInfoCircle/>}
		</div>
		<div>
			{title && <h2 className="font-bold font-display text-lg" >{title}</h2>}
			<div>{txt}</div>
		</div>
	</div>;

export type DropdownPart = {type: "txt", txt?: React.ReactNode}
	| { type: "act", name?: React.ReactNode, act: ()=>void,
			disabled?: boolean, active?: boolean };

export function Dropdown({parts, trigger}: {trigger?: React.ReactNode, parts: DropdownPart[]}) {
	const [open, setOpen] = useState(false);
	return <Popover placement="bottom" showArrow isOpen={open} onOpenChange={setOpen} triggerScaleOnOpen={false} >
		<PopoverTrigger><div>{trigger}</div></PopoverTrigger>
		<PopoverContent className="rounded-md bg-zinc-900 border-gray-800 flex flex-col gap-2 items-stretch px-0 py-0 max-w-44" >
			<div>
				{parts.map((x,i) => {
					//copy pasting is encouraged by tailwind!
					if (x.type=="act")
						return <Button key={i} disabled={x.disabled}
							className={`m-0 border-zinc-700 border-t-0 first:border-t rounded-none first:rounded-t-md last:rounded-b-md hover:bg-zinc-700 w-full active:border-1 ${
								x.active ? "bg-zinc-950" : ""
							}`}
							onClick={() => {
								x.act();
								setOpen(false);
							}} >{x.name}</Button>;
					else return <div key={i}
						className="flex flex-row justify-center gap-4 px-4 py-1.5 bg-zinc-900 items-center border m-0 border-zinc-700 border-t-0 first:border-t rounded-none first:rounded-t-md last:rounded-b-md w-full" >
							{x.txt}
						</div>
				})}
			</div>
		</PopoverContent>
	</Popover>;
}

export function MoreButton({collapsed, children, className, act: hide, down}: {collapsed: boolean, act: ()=>void, children?: React.ReactNode, className?: string, down?: boolean}) {
	return <Collapse isOpened={collapsed} >
		<div className={twMerge("flex flex-col w-full items-center", className)} >
			<button onClick={hide} className={`flex flex-col items-center cursor-pointer transition ${down ? "hover:translate-y-1" : "hover:-translate-y-1"}`} >
				{down ? <>{children}<IconChevronDown/></>
					: <><IconChevronUp/>{children}</>}
			</button>
		</div>
	</Collapse>;
}

export function ShowMore({children, className, forceShowMore}: {children: React.ReactNode, className?: string, forceShowMore?: boolean}) {
	const [showMore, setShowMore] = useState<boolean|null>(false);
	const inner = useRef<HTMLDivElement>(null), ref=useRef<HTMLDivElement>(null);

	useEffect(()=>{
		if (showMore!=null && !forceShowMore
			&& inner.current!!.clientHeight<=ref.current!!.clientHeight+100)
			setShowMore(null); //not needed
	}, [showMore!=null, forceShowMore]);

	if (showMore==null || forceShowMore)
		return <div className={twMerge("overflow-y-auto max-h-dvh", className)} >
			{children}
		</div>;

	return <div className={className} >
		<Collapse isOpened >
			<div ref={ref} className={`relative ${showMore ? "" : "max-h-52 overflow-y-hidden"}`} >
				<div ref={inner} className={showMore ? "overflow-y-auto max-h-dvh" : ""} >
					{children}
				</div>

				<div className="absolute bottom-0 left-0 right-0 z-40" >
					<MoreButton act={()=>setShowMore(true)} collapsed={!showMore} down >
						Show more
					</MoreButton>
				</div>

				{!showMore &&
					<div className="absolute bottom-0 h-14 max-h-full bg-gradient-to-b from-transparent to-zinc-900 z-20 left-0 right-0" ></div>}
			</div>
		</Collapse>

		<MoreButton act={()=>setShowMore(false)} collapsed={showMore} className="pt-2" >
			Show less
		</MoreButton>
	</div>;
}