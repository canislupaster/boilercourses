import { IconBell, IconMail } from "@tabler/icons-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import { RegisterNotificationRequest, RegisterNotificationResponse, type Notification } from "../../shared/availability";
import { UserData } from "../../shared/posts";
import { CourseId, formatTerm, latestTerm, Section, SmallCourse, Term, toSmallCourse, trimCourseNum } from "../../shared/types";
import { CourseLink } from "./card";
import { Alert, Dropdown, TermSelect } from "./clientutil";
import { SectionLink } from "./sectionlink";
import { Anchor, bgColor, Button, containerDefault, Divider, IconButton, Loading, Text, textColor } from "./util";
import { AppCtx, callAPI, ModalActions, ModalCtx, redirectToSignIn, useAPI, useCourse } from "./wrapper";

const AvailabilityUpdateCtx = createContext<()=>void>(()=>{});

function Notification({id, course, satisfied, section, sent, term}: Notification) {
	const del = callAPI<void, number>("notifications/delete", "redirect");
	const ctx = useContext(AvailabilityUpdateCtx);

	return <div className={twMerge(containerDefault, "p-2 flex flex-col gap-1 px-4")} >
		<div className="flex flex-row items-center" >
			<Text v="bold" >
				<CourseLink course={course} type="course" />
			</Text>

			<Divider/>

			{section ? <SectionLink section={section} term={term} course={course} >
				<Anchor><Text v="smbold" >Section {section.section}</Text></Anchor>
			</SectionLink> : <Text v="dim" >all sections</Text>}
		</div>

		<div className="flex flex-row flex-wrap" >
			<Text v={satisfied ? "sm" : "err"} >
				{satisfied ? "We found a spot for you!" : "No space"}
			</Text>
			<Divider/>
			<Anchor onClick={()=>{
				del.run({data: id, refresh: ctx});
			}} className={textColor.red} >Delete</Anchor>
		</div>

		{satisfied && sent && <Text v="smbold" className="flex flex-row gap-1 items-center" >
			<IconMail/> Email sent!
		</Text>}
	</div>;
}

function NotificationCreator({course, section, fixTerm, update}: {
	course: CourseId, section?: Section, fixTerm?: Term, update: ()=>void
}) {
	const register = callAPI<RegisterNotificationResponse, RegisterNotificationRequest>("notifications/register", "redirect");
	const terms = Object.keys(course.course.sections) as Term[];
	const latest = latestTerm(course.course)!;
	const [term, setTerm] = useState(fixTerm ?? latest);
	const ctx = useContext(ModalCtx)!;
	const app = useContext(AppCtx);
	const sm = useMemo(()=>toSmallCourse(course), []);
	const email = useAPI<UserData>("user", {auth: "redirect"});

	const isOpen = (section ? [section] : course.course.sections[term])
		.some(v=>v.seats && v.seats.left>0);

	return <div className="flex flex-col gap-3 mt-3 mr-3" >
		<Text v="md" >Register for notifications for {section
			? <SectionLink section={section} term={term} course={sm} >
					<Anchor>{sm.subject} {trimCourseNum(sm.course)}, section {section.section}</Anchor>
				</SectionLink>
			: <CourseLink type="course" course={sm} />
		}</Text>

		{fixTerm==undefined ? 
			<TermSelect term={term} terms={terms} setTerm={setTerm} label="Be notified for" noUpdated />
		: <Text>
			You will be notified for openings in <b>{formatTerm(term)}</b>.
		</Text>}

		{term!=latest && <Alert txt={`The term you selected is older than the latest term (${formatTerm(latest)}). It will likely be updated infrequently, so you may not get notifications. Use the latest term to stay updated.`} title="Outdated term" />}

		{email && <Text>Notifications will be sent to <b>{email.res.email}</b></Text>}

		{isOpen
		? <Alert bad title={`This ${section ? "section" : "course"} isn't full!`}
			txt={<>You can't register for notifications at the moment. If you want to get notifications for a specific <b>full</b> section, select that section in the calendar.</>} />
		: <ModalActions>
			<Button className={bgColor.sky} onClick={()=>{
				ctx.setLoading(true);
				register.run({
					data: {
						course: course.id, crn: section?.crn ?? null,
						threshold: 1, term: term
					},
					cb(r) {
						if (r) {
							update();
							ctx.closeModal();
							if (r.res.verify) {
								app.open({
									type: "other", name: "Verify your email",
									modal: "To finish registering, please verify your email. We just sent something to you (though it may take a minute to arrive, or end up in spam)."
								});
							}
						}

						ctx.setLoading(false);
					}
				})
			}} >
				Confirm
			</Button>
		</ModalActions>}
	</div>;
}

export function Notifications({course, className}: {course?: CourseId, className?: string}) {
	const notifs = callAPI<Notification[]>("notifications/list", "unset");
	useEffect(()=>notifs.run(), []);
	const app = useContext(AppCtx);

	if (notifs.loading) return <Loading/>;
	let list = notifs.current?.res ?? [];
	if (course!=undefined) list=list.filter(x=>x.course.id==course.id);
	
	return <div className={twMerge("flex flex-col gap-2 items-stretch", className)} >
		{list.length==0 && <div className="flex flex-col items-center p-3 text-center" >
			<Text>{course ? "Want to know when space opens up?" : "No notifications. Try visiting a full course to notify yourself when there's space!"}</Text>
		</div>}

		<AvailabilityUpdateCtx.Provider value={()=>notifs.run()} >
			{list.map(x=><Notification key={x.id} {...x} />)}
		</AvailabilityUpdateCtx.Provider>

		{course && !list.some(v=>v.section==null) && <Button onClick={()=>{
			app.open({
				type: "other",
				modal: <NotificationCreator update={()=>notifs.run()} course={course} />
			});
		}} >
			Register for notifications
		</Button>}
	</div>;
}

export function CourseNotificationButton({course}: {course?: CourseId}) {
	const app = useContext(AppCtx);
	const redir = redirectToSignIn();

	return <Dropdown trigger={<IconButton icon={<IconBell size={18} />} />} parts={app.hasAuth ? [
		{type: "txt", txt: <>
			<Notifications course={course} />
		</>}
	] : [
		{type: "txt", txt: <Text>Want to be notified when this course has space?</Text>},
		{type: "act", name: "Login", act: redir}
	]} ></Dropdown>
}

function NotificationCreatorId({courseId,...props}: {courseId: number}&Omit<React.ComponentProps<typeof NotificationCreator>, "course">) {
	const course = useCourse(courseId);
	return course==null ? <Loading/> : <NotificationCreator course={course} {...props} />
}

export function SectionNotifications({section, small, term}: {section: Section, small: SmallCourse, term: Term}) {
	const notifs = callAPI<Notification[]>("notifications/list", "unset");
	const del = callAPI<void, number>("notifications/delete", "redirect");

	useEffect(()=>notifs.run(), []);
	const app = useContext(AppCtx);
	const redir = redirectToSignIn();
	const actx = useContext(AvailabilityUpdateCtx);
	const isFull = !section.seats || section.seats.left<=0;

	if (isFull && !app.hasAuth) return <Text v="sm" >
		<Anchor onClick={()=>redir()} >Login</Anchor> to be notified when this section has space.
	</Text>;
	else if (notifs.current==null || !isFull) return <></>;
	
	const notif = notifs.current.res.find(x=>x.section?.crn == section.crn);
	return notif==undefined || notif.sent ? <Anchor onClick={()=>{
		app.open({
			type: "other",
			modal: <NotificationCreatorId update={()=>{notifs.run(); actx()}}
				courseId={small.id} section={section} fixTerm={term} />
		});
	}} >Be notified when this section has space</Anchor> : <Text>
		You'll be notified when this section opens up. <Anchor className={textColor.red} onClick={()=>{
			del.run({data: notif.id, refresh() {notifs.run(); actx();}});
		}} >{del.loading ? "Deleting..." : "Delete"}</Anchor>
	</Text>
}
