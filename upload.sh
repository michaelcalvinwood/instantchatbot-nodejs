#!/bin/bash

rsync -a . --exclude 'node_modules' root@instantchatbot.net:/home/instantchatbot/
