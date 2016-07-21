#!/bin/bash
(
  cd server
  ../penv/bin/python manage.py runserver -d --port=5000 --threaded
)
