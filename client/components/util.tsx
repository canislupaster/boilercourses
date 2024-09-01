import { Spinner, SpinnerProps } from "@nextui-org/spinner";
import React, { forwardRef, TextareaHTMLAttributes, useEffect, useState } from "react";
import { AnchorHTMLAttributes, HTMLAttributes } from "react";
import { ClassNameValue, twMerge } from "tailwind-merge";
import { Footer } from "./footer";
import { Popover, PopoverContent, PopoverTrigger } from "@nextui-org/popover";
import { IconChevronDown } from "@tabler/icons-react";
import { ClassNamesConfig } from "react-select";
import Image from "next/image";
import purdue from "../public/purdue-icon.png";
import { LinkProps } from "next/link";
import { AppLink } from "./clientutil";
import { AppCtx } from "./wrapper";
import reddit from "../public/reddit-icon.png";

export const Anchor: React.FC<(AnchorHTMLAttributes<HTMLAnchorElement>)&Partial<LinkProps>> = ({className,href,...props}) => {
	const classN = twMerge(
	`text-gray-300 inline-flex flex-row align-baseline items-baseline gap-1 underline decoration-dashed decoration-1
		underline-offset-2 transition-all hover:text-gray-50 hover:bg-cyan-100/5 cursor-pointer`,className
	);

	//special protocols which nextjs link can't handle...
	if (href?.startsWith("mailto:"))
		return <a className={classN} href={href} {...props} >{props.children}</a>
	else if (href!=undefined)
		return <AppLink href={href} rel="noopener noreferrer" className={classN} {...props} >
			{props.children}
		</AppLink>;
	else return <a className={classN} href="#" {...props} onClick={(ev) => {
		ev.preventDefault();
		props.onClick?.(ev);
	}} >{props.children}</a>
}

export const LogoText = ({className, ...props}: HTMLAttributes<HTMLHRElement>) => 
	<h1 className={twMerge("text-4xl md:text-6xl mr-2 my-auto select-none text-white cursor-pointer font-display font-black", className)} {...props} >BoilerCourses</h1>;

export const Input = ({className, icon, ...props}: {icon?: React.ReactNode}&React.InputHTMLAttributes<HTMLInputElement>) => <div className="relative" >
	<input type="text" className={twMerge(`text-white bg-zinc-800 w-full p-2 border-2 border-zinc-600 focus:outline-none focus:border-blue-500 transition duration-300 rounded-lg ${icon ? "pl-11" : ""}`, className)} {...props} />
	{icon && <div className="absolute left-0 my-auto pl-3 top-0 bottom-0 flex flex-row items-center" >
		{icon}
	</div>}
</div>

export const Textarea = forwardRef<HTMLTextAreaElement, JSX.IntrinsicElements["textarea"]>((
	{className, children, ...props}: JSX.IntrinsicElements["textarea"], ref
) =>
	<textarea className={twMerge("text-white bg-neutral-950 w-full p-2 border-2 border-zinc-900 focus:outline-none focus:border-blue-500 transition duration-300 rounded-lg mb-5 resize-y max-h-60 min-h-24", className)}
		rows={6} {...props} ref={ref} >
		{children}
	</textarea>);

export const Button = ({className, icon, disabled, ...props}: HTMLAttributes<HTMLButtonElement>&{icon?: React.ReactNode, disabled?: boolean}) =>
	<button disabled={disabled} className={twMerge('flex flex-row justify-center gap-1.5 px-4 py-1.5 bg-zinc-800 items-center border text-white rounded-xl border-zinc-700 hover:border-zinc-600 active:border-blue-500 aria-expanded:border-blue-500 group',
		icon ? "pl-3" : "",
		disabled ? " bg-zinc-600 text-gray-400" : "",
		className)} {...props} >

		{icon &&
			<span className="inline-block h-6 w-auto" >{icon}</span> }
		{props.children}
	</button>;

export const IconButton = ({className, icon, ...props}: {icon?: React.ReactNode}&HTMLAttributes<HTMLButtonElement>) =>
	<button className={twMerge("rounded-full p-2 bg-zinc-800 border-zinc-700 border hover:border-zinc-600 active:border-blue-500 flex items-center justify-center aria-expanded:border-blue-500", className)} {...props} >
		{icon}
	</button>;

export const LinkButton = ({className, icon, ...props}: React.AnchorHTMLAttributes<HTMLAnchorElement>&{icon?: React.ReactNode}) =>
	<a className={twMerge('flex flex-row gap-2 px-3 py-1.5 bg-zinc-900 items-center border text-white rounded-xl border-zinc-900 hover:border-zinc-700 active:border-blue-500 text-sm',className)} rel="noopener noreferrer" {...props} >
		{icon &&
			<span className="inline-block h-4 w-auto" >{icon}</span> }
		{props.children}
	</a>

export const Loading = (props: SpinnerProps) => <div className="h-full w-full flex item-center justify-center py-16 px-20" >
	<Spinner color="white" size="lg" {...props} ></Spinner>
</div>

export const chipColors = {
	red: "bg-red-600 border-red-400",
	green: "bg-green-600 border-green-400",
	blue: "border-cyan-400 bg-sky-600",
	gray: "border-gray-300 bg-gray-600",
	purple: "bg-purple-600 border-purple-300",
	teal: "bg-[#64919b] border-[#67cce0]"
};

export const chipColorKeys = Object.keys(chipColors) as (keyof typeof chipColors)[];

export const Chip = ({className, color, ...props}: HTMLAttributes<HTMLSpanElement>&{color?: keyof typeof chipColors}) =>
	<span className={twMerge("inline-block text-xs px-3 py-1 mx-0.5 my-0.5 rounded-full border-solid border whitespace-nowrap", chipColors[color ?? "gray"], className)}
		{...props} >{props.children}</span>

export const StatusPage = ({children, title}: {children: React.ReactNode, title: string}) =>
	<>
		<div className="flex h-dvh flex-col justify-between items-center py-20 px-5" >
			<AppLink href="/" ><LogoText/></AppLink>
			<div className="flex flex-col lg:w-96" >
				<h1 className="font-display font-extrabold text-4xl mb-4" >{title}</h1>
				<div className="flex flex-col gap-4">
					{children}
				</div>
			</div>

			<Footer/>
		</div>
	</>;

export function ButtonPopover({children, className, title, desc}: {children: React.ReactNode, className?: ClassNameValue, title: string, desc?: string}) {
	return <Popover placement="bottom" showArrow triggerScaleOnOpen={false} >
		<PopoverTrigger>
			<div className="flex-1 md:flex-none" >
				<Button className={twMerge("w-full h-full pr-3 justify-between", className)} >
					<div className="flex flex-col items-start justify-center" >
						<span>{title}</span>
						<span className="text-gray-300 text-sm whitespace-nowrap" >{desc}</span>
					</div>
					<IconChevronDown />
				</Button>
			</div>
		</PopoverTrigger>
		<PopoverContent className='bg-zinc-900 border-gray-800 p-5 pt-3' >
			{children}
		</PopoverContent>
	</Popover>;
}

export const abbr = (s: string, len: number=300) =>
	s.length > len ? `${s.substring(0, len-3)}...` : s;

const selectStyle: ClassNamesConfig<any,any> = {
	control: (state) => `flex flex-row gap-4 px-3 py-1.5 bg-zinc-800 items-center border-2 text-white rounded-lg hover:cursor-pointer ${state.menuIsOpen ? "border-blue-500" : "border-zinc-600"}`,
	menuList: (props) => "border-zinc-700 rounded-lg bg-black border bg-zinc-900 mt-1 flex flex-col items-stretch",
	option: ({ isDisabled, isFocused, isSelected }) => {
		return `${isFocused ? "bg-zinc-800" : ""} hover:bg-zinc-800 p-2 border-t first:border-none border-zinc-700 hover:cursor-pointer ${isDisabled ? "text-gray-500" : ""}`;
	},
	menu: (base) => "text-white absolute w-full",
	multiValue: ({ data }) => "bg-zinc-700 text-white px-2 py-0.5 rounded-md",
	multiValueLabel: ({ data }) => "text-white hover:bg-zinc-700",
	valueContainer: (props) => "flex flex-row gap-1 overflow-x-scroll",
	multiValueRemove: ({ data }) => "text-white hover:bg-zinc-700 hover:text-white ml-1",
	indicatorSeparator: (props) => "mx-1 h-full bg-zinc-600",
	input: (props) => "text-white",
	noOptionsMessage: (props) => "py-2",
	indicatorsContainer: (props) => "text-white",
}

export const selectProps = {
	unstyled: true, classNames: selectStyle,
	styles: {menu: (props: any) => ({zIndex: 100})}
};

export function gpaColor(gpa: number|null): string|undefined {
	if (gpa==null) return undefined;
	return `hsl(${13+(107-13)*Math.pow(gpa,2.5)/Math.pow(4.0,2.5)}, 68%, 42%)`;
}

export const firstLast = (s: string) => {
	const x = s.split(/\s+/);
	return x.length>=2 ? `${x[0]} ${x[x.length-1]}` : x[0];
};

export function shitHash(s: string) {
	let v=3, mod=17, o=0;
	for (let i=0; i<s.length; i++) {
		o+=s.charCodeAt(i)*v;
		if (o>=mod) o-=mod;
		v=3*v %mod;
	}
	return o;
}

export const CatalogLinkButton = ({href}: {href:string}) =>
	<LinkButton href={href} target="_blank"
		className="bg-[#D8B600] hover:bg-[#a88d00] transition-all duration-300 ease-out text-white"
		icon={<Image src={purdue} alt="Purdue Catalog" className="w-auto h-full" />}>
		Catalog
	</LinkButton>

export const RedditButton = ({keywords}: {keywords:string[]}) =>
	<LinkButton href={`https://www.reddit.com/r/Purdue/search/?q=${
			encodeURIComponent(keywords.join(" OR "))
		}`} target="_blank" rel="noopener noreferrer" className="bg-orange-600 hover:bg-orange-700 transition-background duration-300 ease-out"
		icon={<Image src={reddit} alt="Reddit" className="w-auto h-full" />}>

		Reddit
	</LinkButton>;

export function capitalize(s: string) {
	const noCap = ["of", "a", "an", "the", "in"];
	return s.split(/\s+/g).filter(x=>x.length>0).map((x,i)=>{
		if (i>0 && noCap.includes(x)) return x;
		else return `${x[0].toUpperCase()}${x.slice(1)}`;
	}).join(" ");
}

// export const AppSelect = ({...props}: SelectProps) => <Select {...props}
// 		classNames={{
// 			trigger: twMerge("px-4 py-1.5 bg-zinc-900 border text-white rounded-xl border-zinc-900 hover:border-zinc-700 data-[hover=true]:bg-zinc-900 data-[open=true]:border-blue-500", props.classNames?.trigger)
// 		}}
// 	>
// 	{props.children}
// </Select>