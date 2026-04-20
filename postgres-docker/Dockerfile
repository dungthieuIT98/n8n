FROM postgres:15

# set environment default
ENV POSTGRES_USER=airflow
ENV POSTGRES_PASSWORD=airflow
ENV POSTGRES_DB=airflow

# copy init script
COPY init /docker-entrypoint-initdb.d

# expose port
EXPOSE 5432
