# [BoilerClasses](https://www.boilerclasses.com/)


https://github.com/unkn-wn/boilerclasses/assets/37767310/e7158449-630b-4ed6-a7e4-1bb716d31fa9


# Structure
BoilerClasses is a simple [Next.js](https://nextjs.org/) app with a few Python helper files to format and organize the data. We use a [Redis](https://redis.io/) instance to store and rapidly query all our data. 

We use [Fly.io](https://fly.io/) through [Docker](https://www.docker.com/) to host our app. More steps to run the Docker container through our Dockerfile can be found below. 

# Setup
You can clone this repository and run a local instance of the app in two ways (with or without Docker):

## With Docker
Make sure you have `docker` installed and the daemon running. More information about installation can be found [here](https://docs.docker.com/get-docker/). Once you get that up and running, navigate into the cloned repository and run:

```
docker build . -t boilerclasses
```
After the image is created, run:
```
docker run -it -p 3000:3000 boilerclasses
```
This will expose the container's port `3000` to your machine. Navigate to `localhost:3000` to view the app! You can edit whatever files you want locally, but you'll have to rebuild the image every time you want to view your changes. Thus, not ideal for quick changes.

## Without Docker
1. Firstly, make sure you have [python](https://www.python.org/downloads/), [node](https://nodejs.org/en/download/), and [redis](https://redis.io/docs/install/install-redis/) installed.
2. Then, navigate into the `server` directory and run the following commands:
   ```
   python3 download.py
   python3 harmonize.py
   ```
   `download.py` will download JSON files for you from our [S3 bucket](https://s3.amazonaws.com/boilerclasses) and `harmonize.py` will combine these to give you a single JSON file containing all the information required. More details regarding what these files do are coming soon.  
3. Now, you want to spawn a Redis instance at the port `6379`. To do this, run the following command:
   ```
   redis-server --daemonize yes
   ```
   The `daemonize` argument will make it run in the background.
4. Once you have that, you can push all the data from the JSON file generated in step 2 to the Redis instance. To do this, run:
   ```
   python3 push.py
   ```
5. Now, navigate back to the root directory and run:
   ```
   npm run dev
   ```
   Now, you can make changes within the Next.js app and have them reflect in real-time at `localhost:3000`!


# Future Improvements
We're trying to integrate as many features as possible, and we'll have open issues for the same. If you find a bug or have any feedback, let us through a [PR](https://github.com/unkn-wn/boilerclasses/pulls) or our [feedback form](https://docs.google.com/forms/d/e/1FAIpQLScoE5E-G7dbr7-v9dY5S7UeIoojjMTjP_XstLz38GBpib5MPA/viewform). All contributions are very, very welcome!

# Acknowledgements
Inspired by [classes.wtf](https://classes.wtf) and Purdue's slow course catalogs. We'd like to also thank our friends over at [Boilerexams](https://boilerexams.com) and [BoilerGrades](https://boilergrades.com/).
