require 'rubygems'
require 'bundler/setup'
Bundler.require
if development?
  $stdout.sync = true
  require 'sinatra/reloader'
  $:.unshift File.expand_path '../lib', File.dirname(__FILE__)
end
require 'sinatra/cometio'
require File.dirname(__FILE__)+'/web-app'

set :haml, :escape_html => true

run Sinatra::Application
