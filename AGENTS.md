**Rules for conducting a "Grill Me" session**
  * At the beginning of a `/grill-me` session, ALWAYS checkout a new branch. Name it with the current timestamp.
  * At the end of a `/grill-me` session, change the name of the current branch to something meaningful, based on the work that was discussed. Keep it short (four words or less, separated by dashes)

**Rules for feature dev**
  * After completing an implementation plan:
    1. ALWAYS commit the code using git, with a _conventional commit_ message
    2. Prompt the user for the next step and proceed according to the user's choice:
      a. push the current branch to remote and open a pull request, with a description explaning the change
      b. push the current branch to remote but DO NOT open a pull request
      c. merge the current branch to main and checkout main
      d. do nothing
