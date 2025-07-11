# Models are defined in app.py for this simple application
# This file exists to maintain compatibility with the blueprint structure
from app import db, Company, Location

__all__ = ['db', 'Company', 'Location']
