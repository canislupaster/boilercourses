import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
	return knex.schema
		.createTable("user", tb=>{
			tb.bigIncrements("id");
			tb.text("email").notNullable().unique();
			tb.text("name")
			tb.boolean("banned").notNullable().defaultTo(false)
			tb.boolean("admin").notNullable().defaultTo(false)
		})
		.createTable("session", tb=>{
			tb.bigIncrements("id");
			tb.integer("user").references("user.id").notNullable();
			tb.binary("key").notNullable()
			tb.timestamp("created").notNullable()
		})
		.createTable("course_post", tb=>{
			tb.bigIncrements("id");
			tb.integer("course").references("course.id").notNullable();

			tb.boolean("showName").notNullable();
			tb.integer("rating");
			tb.boolean("new").notNullable();
			tb.integer("user").references("user.id").notNullable();

			tb.text("text").notNullable();
			tb.timestamp("submitted").notNullable();
		})
		.createTable("post_report", tb=>{
			tb.bigIncrements("id");
			tb.integer("user").references("user.id").notNullable();
			tb.integer("post").references("course_post.id").notNullable().index();
			tb.timestamp("submitted").notNullable();
			tb.unique(["user", "post"]);
		});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema
		.dropTable("user")
		.dropTable("session")
		.dropTable("course_post");
}