import type {Knex} from "knex";


export async function up(knex: Knex): Promise<void> {
	return knex.schema
		.createTable("user", tb=>{ //users should not be deleted, since posts rely on them...
			tb.bigIncrements("id");
			tb.text("email").notNullable().unique();
			tb.text("name")
			tb.boolean("banned").notNullable().defaultTo(false)
			tb.boolean("admin").notNullable().defaultTo(false)
		})
		.createTable("session", tb=>{
			tb.text("id").notNullable().primary();
			tb.integer("user").references("user.id").onDelete("CASCADE");
			tb.binary("key").notNullable()
			tb.timestamp("created").notNullable()
		})
		.createTable("course_post", tb=>{
			tb.bigIncrements("id");
			tb.integer("course").references("course.id").notNullable().onDelete("CASCADE");

			tb.text("name");
			tb.integer("rating");
			tb.integer("votes").notNullable().defaultTo(0);
			tb.boolean("new").notNullable();
			tb.integer("user").references("user.id").notNullable().onDelete("CASCADE");

			tb.text("text").notNullable();
			tb.timestamp("submitted").notNullable();

			tb.unique(["course", "user"]);
		})
		.createTable("post_report", tb=>{
			tb.bigIncrements("id");
			tb.integer("user").references("user.id").notNullable().onDelete("CASCADE");
			tb.integer("post").references("course_post.id").notNullable().index().onDelete("CASCADE");
			tb.timestamp("submitted").notNullable();
			tb.unique(["user", "post"]);
		})
		.createTable("post_vote", tb=>{
			tb.bigIncrements("id");
			tb.integer("user").references("user.id").notNullable().onDelete("CASCADE");
			tb.integer("post").references("course_post.id").notNullable().index().onDelete("CASCADE");
			tb.timestamp("submitted").notNullable();
			tb.unique(["user", "post"]);
		});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema
		.dropTable("post_vote")
		.dropTable("post_report")
		.dropTable("session")
		.dropTable("course_post")
		.dropTable("user");
}